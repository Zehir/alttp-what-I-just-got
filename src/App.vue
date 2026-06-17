<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import {
    USB2SNES_OPCODES,
    USB2SNES_SPACES,
    useUSB2SNES,
    type USB2SNESResponse,
} from "./lib/usb2snes-client";

const { status, data, errorMessage, open, close, send, sendImmediate, ws } = useUSB2SNES(
    "ws://localhost:23074/",
    { autoConnect: true },
);

type ResponseHandler = ((data: USB2SNESResponse) => void) | undefined;



const refreshDevices = async () => {
    errorMessage.value = "";

    try {
        await open();
        const availableDevices = await send(USB2SNES_OPCODES.DEVICE_LIST);

        if (!Array.isArray(availableDevices) || availableDevices.length === 0) {
            errorMessage.value = "No devices found.";
            return;
        }

        await send(USB2SNES_OPCODES.ATTACH, [String(availableDevices[0])]);

    } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : String(error);
    }
};

type AlttpItem = {
    index: number;
    // time: Date
    item: String;
};

const items = ref<AlttpItem[]>([
    {
        index: 0,
        //time: new Date(),
        item: "Item 1",
    },
]);


const scrollContainerRef = ref<HTMLElement | null>(null);

const rowVirtualizer = useVirtualizer({
    count: items.value.length,
    getScrollElement: () => scrollContainerRef.value,
    estimateSize: () => 35,
});

onMounted(() => {
    void open();
});
</script>

<template>
    <main class="container">
        <div class="action-container">
            <button class="btn" @click.prevent="refreshDevices">Refresh Devices</button>
        </div>

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

        {{ status }}

        <div ref="scrollContainerRef" style="height: 400px; overflow-y: auto">
            <div :style="{ height: rowVirtualizer.getTotalSize() + 'px', position: 'relative' }">
                <div v-for="virtualRow in rowVirtualizer.getVirtualItems()" :key="virtualRow.index" :style="{
                    position: 'absolute',
                    top: virtualRow.start + 'px',
                    left: 0,
                    width: '100%',
                    height: virtualRow.size + 'px',
                }">
                    {{ items[virtualRow.index] }}
                </div>
            </div>
        </div>
    </main>
</template>

<style scoped>
.container {
    max-width: 960px;
    margin: 0 auto;
    padding: 2rem 1rem;
}

.action-container {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
}

.btn {
    border: none;
    border-radius: 8px;
    padding: 0.6rem 1rem;
    font-size: 0.95rem;
    cursor: pointer;
    background: #1f2937;
    color: #fff;
}

.btn.secondary {
    background: #e5e7eb;
    color: #111827;
    margin-top: 0.5rem;
}

.list {
    list-style: decimal;
    padding-left: 1.25rem;
}

.device-item {
    margin-bottom: 1.25rem;
}

.device-name {
    margin-bottom: 0.35rem;
}

.device-label {
    font-weight: 600;
}

.json {
    margin-top: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #f9fafb;
}

.json pre {
    margin: 0;
    padding: 0.75rem;
    white-space: pre-wrap;
    word-break: break-word;
}

.empty {
    text-align: center;
}

.error {
    color: #b91c1c;
    text-align: center;
    margin-bottom: 1rem;
}
</style>
