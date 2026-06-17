import { computed, onBeforeUnmount, ref, shallowRef } from "vue";

export const USB2SNES_KEYS = {
    OPCODE: "Opcode",
    SPACE: "Space",
    FLAGS: "Flags",
    OPERANDS: "Operands",
    RESULTS: "Results",
} as const;

export const USB2SNES_SPACES = {
    SNES: "SNES",
    CMD: "CMD",
} as const;

export const USB2SNES_OPCODES = {
    DEVICE_LIST: "DeviceList",
    ATTACH: "Attach",
    APP_VERSION: "AppVersion",
    NAME: "Name",
    CLOSE: "Close",
    INFO: "Info",
    BOOT: "Boot",
    MENU: "Menu",
    RESET: "Reset",
    BINARY: "Binary",
    STREAM: "Stream",
    FENCE: "Fence",
    GET_ADDRESS: "GetAddress",
    PUT_ADDRESS: "PutAddress",
    PUT_IPS: "PutIPS",
    GET_FILE: "GetFile",
    PUT_FILE: "PutFile",
    LIST: "List",
    REMOVE: "Remove",
    RENAME: "Rename",
    MAKE_DIR: "MakeDir",
} as const;

export type USB2SNESSpace = (typeof USB2SNES_SPACES)[keyof typeof USB2SNES_SPACES];
export type USB2SNESOpcode = (typeof USB2SNES_OPCODES)[keyof typeof USB2SNES_OPCODES] | string;
export type USB2SNESResponse = unknown | ArrayBuffer;
export type USB2SNESStatus = "CLOSED" | "CONNECTING" | "OPEN" | "ATTACHED" | "ERROR";

interface CommandPayload {
    opcode: USB2SNESOpcode;
    operands: string[];
    flags: string[];
    space: USB2SNESSpace;
}

interface QueuedCommand extends CommandPayload {
    resolve: (value: USB2SNESResponse) => void;
}

interface UseUSB2SNESOptions {
    autoConnect?: boolean;
}

/**
 * Vue composable wrapper for the USB2SNES WebSocket client.
 * Based on https://github.com/djrideout/node-usb2snes-client
 */
export function useUSB2SNES(addr: string, options: UseUSB2SNESOptions = {}) {
    const ws = shallowRef<WebSocket | null>(null);
    const status = ref<USB2SNESStatus>("CLOSED");
    const data = ref<USB2SNESResponse | null>(null);
    const errorMessage = ref("");
    const isOpen = computed(() => status.value === "OPEN");
    const isAttached = computed(() => status.value === "ATTACHED");

    const commands: QueuedCommand[] = [];
    let connectPromise: Promise<WebSocket> | null = null;
    let processing = false;

    /**
     * Serialize and send a single USB2SNES command frame.
     */
    const sendInternal = (command: CommandPayload): void => {
        if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
            throw new Error("USB2SNES socket is not open");
        }

        const payload: Record<string, unknown> = {
            [USB2SNES_KEYS.OPCODE]: command.opcode,
            [USB2SNES_KEYS.SPACE]: command.space,
        };

        if (command.operands.length > 0) {
            payload[USB2SNES_KEYS.OPERANDS] = command.operands;
        }
        if (command.flags.length > 0) {
            payload[USB2SNES_KEYS.FLAGS] = command.flags;
        }

        ws.value.send(JSON.stringify(payload));

        switch (command.opcode) {
            case USB2SNES_OPCODES.ATTACH:
                status.value = "ATTACHED";
                break;
        }
    };

    /**
     * Resolve the oldest queued command when a response arrives.
     */
    const onMessage = (event: MessageEvent<string | ArrayBuffer>): void => {
        const command = commands.shift();
        if (!command) {
            processing = false;
            return;
        }

        let result: USB2SNESResponse;
        if (typeof event.data === "string") {
            try {
                const parsed = JSON.parse(event.data) as Record<string, unknown>;
                result = parsed[USB2SNES_KEYS.RESULTS] ?? parsed;
            } catch {
                result = event.data;
            }
        } else {
            result = event.data;
        }

        data.value = result;
        command.resolve(result);

        if (commands.length > 0) {
            sendInternal(commands[0]!);
        } else {
            processing = false;
        }
    };

    /**
     * Start the queue processor if no command is currently in flight.
     */
    const processCommands = (): void => {
        if (processing || commands.length === 0) {
            return;
        }

        processing = true;
        sendInternal(commands[0]!);
    };

    /**
     * Open the WebSocket connection if it is not already open.
     */
    const open = async (): Promise<WebSocket> => {
        if (ws.value && ws.value.readyState === WebSocket.OPEN) {
            return ws.value;
        }

        if (connectPromise) {
            return connectPromise;
        }

        status.value = "CONNECTING";
        errorMessage.value = "";

        connectPromise = new Promise<WebSocket>((resolve, reject) => {
            try {
                const nextWs = new WebSocket(addr);
                nextWs.binaryType = "arraybuffer";

                const cleanup = () => {
                    nextWs.removeEventListener("error", onError);
                    nextWs.removeEventListener("open", onOpen);
                };

                const onError = (event: Event) => {
                    cleanup();
                    status.value = "ERROR";
                    errorMessage.value = `Error connecting to USB2SNES server${
                        event instanceof ErrorEvent && event.message ? `: ${event.message}` : ""
                    }`;
                    reject(new Error(errorMessage.value));
                };

                const onOpen = () => {
                    cleanup();
                    ws.value = nextWs;
                    ws.value.addEventListener("message", onMessage);
                    ws.value.addEventListener("close", onClose);
                    status.value = "OPEN";
                    resolve(nextWs);
                };

                const onClose = (event: CloseEvent) => {
                    ws.value = null;
                    processing = false;
                    commands.length = 0;
                    status.value = "CLOSED";
                    if (event.code !== 1000) {
                        errorMessage.value = `Connection closed (${event.code})${event.reason ? `: ${event.reason}` : ""}`;
                    }
                };

                nextWs.addEventListener("error", onError);
                nextWs.addEventListener("open", onOpen);
            } catch (error) {
                status.value = "ERROR";
                errorMessage.value = `Error creating USB2SNES client${
                    error instanceof Error && error.message ? `: ${error.message}` : ""
                }`;
                reject(error instanceof Error ? error : new Error(errorMessage.value));
            }
        }).finally(() => {
            connectPromise = null;
        });

        return connectPromise;
    };

    /**
     * Close the WebSocket connection and clear the current queue.
     */
    const close = (): void => {
        const nextWs = ws.value;
        if (!nextWs) {
            return;
        }

        nextWs.removeEventListener("message", onMessage);

        if (nextWs.readyState === WebSocket.OPEN) {
            sendImmediate(USB2SNES_OPCODES.CLOSE);
        }

        nextWs.close();
        ws.value = null;
        processing = false;
        commands.length = 0;
        status.value = "CLOSED";
    };

    /**
     * Send a command and resolve with the next response frame.
     */
    const send = async (
        opcode: USB2SNESOpcode,
        operands: string[] = [],
        flags: string[] = [],
        space: USB2SNESSpace = USB2SNES_SPACES.SNES,
    ): Promise<USB2SNESResponse> => {
        await open();

        const response = await new Promise<USB2SNESResponse>((resolve) => {
            commands.push({
                opcode,
                operands,
                flags,
                space,
                resolve,
            });
            processCommands();
        });

        data.value = response;
        return response;
    };

    /**
     * Send a command without waiting for a response.
     */
    const sendImmediate = (
        opcode: USB2SNESOpcode,
        operands: string[] = [],
        flags: string[] = [],
        space: USB2SNESSpace = USB2SNES_SPACES.SNES,
    ): void => {
        sendInternal({
            opcode,
            operands,
            flags,
            space,
        });
    };

    const read = (address: number, length: number = 1): Promise<ArrayBuffer> => {
        return send(
            USB2SNES_OPCODES.GET_ADDRESS,
            [(0xf50000 + (address - 0x7e0000)).toString(16), length.toString(16)],
            [],
            USB2SNES_SPACES.CMD
        ) as Promise<ArrayBuffer>;
    };

    if (options.autoConnect) {
        void open();
    }

    onBeforeUnmount(() => {
        close();
    });

    return {
        ws,
        status,
        isOpen,
        isAttached,
        data,
        errorMessage,
        open,
        close,
        send,
        sendImmediate,
        read,
    };
}
