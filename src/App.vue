<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual';
import { useIntervalFn, useWebSocket } from '@vueuse/core';

const errorMessage = ref('')

type ResponseHandler = ((data: any, event: Event, ws: WebSocket) => void) | undefined

let responseHandler: ResponseHandler = undefined




const { status, data, send, open, close, ws } = useWebSocket('ws://localhost:23074/', {
  autoReconnect: true,
  onConnected(ws) {
    request({
      "Opcode": "DeviceList",
      "Space": "SNES"
    }, (data) => {
      if (data["Results"].length == 0) {
        errorMessage.value = 'No devices found.'
        return
      }

      console.log("Avaliable devices:", data["Results"])
      console.log("Connecting to device:", data["Results"][0])
      request({
        "Opcode": "Attach",
        "Space": "SNES",
        "Operands": [data["Results"][0]]
      })


    })
  },
  onDisconnected(ws, event) {
    console.log('Disconnected!', event.code)
  },
  onError(ws, event) {
    console.error('Error:', event)
  },
  onMessage(ws, event) {
    if (!responseHandler) {
      return
    }

    if (typeof event.data === 'string') {
      try {
        const parsedData = JSON.parse(event.data)
        responseHandler(parsedData, event, ws)
      } catch (err) {
        console.error('Failed to parse JSON:', err)
      }
    } else if (event.data instanceof Blob) {
      const cachedHandler = responseHandler
      event.data.arrayBuffer().then(buffer => {
        cachedHandler(new Uint8Array(buffer), event, ws)
      }).catch(err => {
        console.error('Failed to read Blob as ArrayBuffer:', err)
      })
    } else {
      console.warn('Received unknown data type:', event.data)
    }
    responseHandler = undefined
  },

})

function request(data: Object, responseHandlerFunc: ResponseHandler = undefined) {
  if (status.value == 'OPEN') {
    responseHandler = responseHandlerFunc
    send(JSON.stringify(data))
  }
}

function read(address: number, length: number, responseHandlerFunc: ResponseHandler = undefined) {
  request({
    "Opcode": "GetAddress",
    "Space": "SNES",
    "Operands": [(0xF50000 + (address - 0x7E0000)).toString(16), length.toString(16)]
  }, responseHandlerFunc)
}





const { pause, resume, isActive } = useIntervalFn(() => {
  read(0x7EF43C, 2, (data) => {
    console.log('Read response:', data)
  })

}, 1000, {immediate: false})



const refreshDevices = async () => {
  errorMessage.value = ''

  resume()
  
}


function readValue() {
  console.log('readValue called')
}



const toHex = (data: Uint8Array) =>
  Array.from(data)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(' ')


type AlttpItem = {
  index: number
  // time: Date
  item: String
}


const items = ref<AlttpItem[]>([
  {
    index: 0,
    //time: new Date(),
    item: 'Item 1',
  },
])

const scrollContainerRef = ref<HTMLElement | null>(null)

const rowVirtualizer = useVirtualizer({
  count: items.value.length,
  getScrollElement: () => scrollContainerRef.value,
  estimateSize: () => 35,
})

onMounted(() => {
  //refreshDevices()


})

</script>

<template>
  <main class="container">
    <div class="action-container">
      <button class="btn" @click.prevent="refreshDevices">Refresh Devices</button>
    </div>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    {{ status }}
    <div ref="scrollContainerRef" style="height: 400px; overflow-y: auto;">
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
