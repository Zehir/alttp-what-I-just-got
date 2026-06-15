<script setup lang="ts">
import { ref } from 'vue'
import { GrpcWebFetchTransport } from '@protobuf-ts/grpcweb-transport'
import type { DevicesResponse_Device } from '../lib/sni'
import { DevicesClient } from '../lib/sni.client'

type Device = DevicesResponse_Device

const transport = new GrpcWebFetchTransport({
  baseUrl: 'http://localhost:8190',
})

const devices = ref<Device[] | null>(null)
const expandedUris = ref<Record<string, boolean>>({})
const errorMessage = ref('')

const listDevices = async () => {
  errorMessage.value = ''

  try {
    const client = new DevicesClient(transport)
    const { response } = await client.listDevices({ kinds: [] })
    devices.value = response.devices
  } catch (err: unknown) {
    const error = err as Error
    const message = error.message.includes('Failed to fetch')
      ? 'Could not connect to SNI'
      : error.message

    errorMessage.value = message
    devices.value = null
  }
}

const toggleExpanded = (uri: string) => {
  expandedUris.value[uri] = !expandedUris.value[uri]
}

const isExpanded = (uri: string) => {
  return Boolean(expandedUris.value[uri])
}
</script>

<template>
  <main class="container">
    <div class="action-container">
      <button class="btn" @click.prevent="listDevices">List Devices</button>
    </div>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <div v-if="devices && devices.length === 0" class="empty">No devices found</div>

    <ol v-if="devices && devices.length > 0" class="list">
      <li v-for="device in devices" :key="device.uri" class="device-item">
        <div class="device-name">
          <span class="device-label">{{ device.displayName || '(no display name)' }}</span>
        </div>

        <button
          class="btn secondary"
          @click.prevent="toggleExpanded(device.uri)"
        >
          {{ isExpanded(device.uri) ? 'Hide full data' : 'View full data' }}
        </button>

        <div v-if="isExpanded(device.uri)" class="json">
          <pre>{{ JSON.stringify(device, null, 2) }}</pre>
        </div>
      </li>
    </ol>
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
