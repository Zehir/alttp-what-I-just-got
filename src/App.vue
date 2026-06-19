<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import {UseTimeAgo} from "@vueuse/components"
import {
    USB2SNES_OPCODES,
    USB2SNES_SPACES,
    useUSB2SNES,
    type USB2SNESResponse,
} from "./lib/usb2snes-client";

import { itemNameById } from "./lib/item-list";

const { status, data, errorMessage, open, close,read, send, sendImmediate, createWatcher, ws } = useUSB2SNES(
    "ws://localhost:23074/",
    { autoConnect: true },
);

const testValue = ref<String>("");

const positionLink = ref<String>("");

let testduree: number = 0
let testdureeReset: number = Date.now()

const results = ref<number[]>([]);
const resultsReset = ref<number[]>([]);

type AlttpItem = {
    itemID: number;
    time: number;
    itemName: string;
};

const items = ref<AlttpItem[]>([]);


const stats = computed(() => {
    if (results.value.length === 0) return null;
    const min = Math.min(...results.value);
    const max = Math.max(...results.value);
    const average = results.value.reduce((a, b) => a + b, 0) / results.value.length;
    console.log({ min, max, average, results: results.value });
    return { min, max, average };
});


const statsReset = computed(() => {
    if (resultsReset.value.length === 0) return null;
    const min = Math.min(...resultsReset.value);
    const max = Math.max(...resultsReset.value);
    const average = resultsReset.value.reduce((a, b) => a + b, 0) / resultsReset.value.length;
    console.log({ min, max, average, resultsReset: resultsReset.value });
    return { min, max, average };
});




const refreshDevices = async () => {
    errorMessage.value = "";
    try {
        await open();
        const availableDevices = await send(USB2SNES_OPCODES.DEVICE_LIST);
        const firstDevice = availableDevices[0];
        if (firstDevice == undefined) {
            errorMessage.value = "No devices found.";
            return;
        }
        sendImmediate(USB2SNES_OPCODES.ATTACH, [firstDevice]);

        
        /*
        var watcher = createWatcher(data => {
            positionLink.value = [
                data.getUint16(0, true).toString(16).padStart(4, "0"),
                data.getUint16(2, true).toString(16).padStart(4, "0")
            ].join(" ")
        }, 0x7E0020, 4, 1/60)
        */
        
        
        var watcher = createWatcher(data => {

            var ancilla_list = []

            for (var i = 0; i < 8; i++) {
                ancilla_list.push(data.getUint8(i))
            }

            testValue.value = ancilla_list.map(a=>a.toString(16).padStart(2, "0")).join(" ")
            if (testduree == 0){
                if (ancilla_list.includes(0x22)){
                    resultsReset.value.push(Date.now() - testdureeReset)
                    testduree = Date.now()
                    testdureeReset = 0
                }
            }else {
                if (!ancilla_list.includes(0x22)){
                    results.value.push(Date.now() - testduree)
                    read(0x7E02D8, 2).then((data) => {
                        items.value.push({
                            itemID: data.getUint8(0),
                            itemName: itemNameById[data.getUint8(0)] ?? "Unknown item",
                            time: Date.now(),
                        })
                    })


                    
                    testduree = 0
                    testdureeReset = Date.now()

                    
                    setTimeout(() => {
                        console.log("Reading item name for item ID...")
                        read(0x7E02D8, 2).then((data) => {
                            if (items.value[items.value.length - 1] != undefined) {
                                items.value[items.value.length - 1]!.itemName += " | " + data.getUint8(0).toString(16).padStart(2, "0") + " - " + (itemNameById[data.getUint8(0)] ?? "Unknown item")
                            }
                        })
                        
                    }, 100)


                }
            }
            
        }, 0x7E0C4A, 0x0A, 1/60)

    } catch (error) {
        errorMessage.value = error instanceof Error ? error.message : String(error);
    }
};


const scrollContainerRef = ref<HTMLElement | null>(null);

const rowVirtualizer = useVirtualizer({
    count: items.value.length,
    getScrollElement: () => scrollContainerRef.value,
    estimateSize: () => 35,
});


onMounted(() => {
    refreshDevices();
});
</script>

<template>
    <main class="container">
        <div class="action-container">
            <button class="btn" @click.prevent="refreshDevices">Refresh Devices</button>
        </div>

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

        {{ status }}

        <br>

        {{ testValue }}

        <br>
        {{ stats ? `Min: ${stats.min}ms, Max: ${stats.max}ms, Average: ${stats.average.toFixed(2)}ms` : "No results yet." }}

        <br>

        {{ statsReset ? `Min: ${statsReset.min}ms, Max: ${statsReset.max}ms, Average: ${statsReset.average.toFixed(2)}ms` : "No results yet." }}

        <br>

        {{ positionLink }}

        <br>

        
        <div v-for="item in items" :key="item.time">
            <UseTimeAgo v-slot="{ timeAgo }" :time="item.time">
                {{ timeAgo }} ({{ item.time }}) - {{ item.itemID.toString(16).padStart(2, "0") }} - {{ item.itemName }}
            </UseTimeAgo>
        </div>
        <!--
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
        -->
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
