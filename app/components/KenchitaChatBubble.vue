<script setup lang="ts">
type ChatRole = 'user' | 'assistant'

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  pending?: boolean
}

type MessageInline = {
  text: string
  bold: boolean
}

type MessageBlock =
  | {
    type: 'paragraph'
    parts: MessageInline[]
  }
  | {
    type: 'list'
    ordered: boolean
    items: MessageInline[][]
  }

const COLLAPSED_KEY = 'nexa-kenchita-chat-collapsed'
const CHAT_OPEN_KEY = 'nexa-kenchita-chat-open'

const isCollapsed = ref(false)
const isChatOpen = ref(false)
const isSending = ref(false)
const isLoadingHistory = ref(false)
const historyLoaded = ref(false)
const draft = ref('')
const conversationId = ref<string | null>(null)
const messagesEl = ref<HTMLElement | null>(null)
const messages = ref<ChatMessage[]>([
  {
    id: 'welcome',
    role: 'assistant',
    content: 'Hola, soy Kenchita. Puedo ayudarte a revisar precios, ventas, catalogo y acciones para mejorar tu negocio en Cobija.',
  },
])

const quickPrompts = [
  'Ideas para vender mas',
  'Analizar mis precios',
  'Que productos no se venden?',
]

const chatTitle = computed(() => isSending.value ? 'Kenchita esta pensando' : 'Kenchita IA')
const hasActiveConversation = computed(() => Boolean(conversationId.value) || messages.value.length > 1)
const lastAssistantMessage = computed(() => [...messages.value].reverse().find((item) => item.role === 'assistant' && !item.pending)?.content ?? '')
const previewDescription = computed(() => {
  if (!hasActiveConversation.value) {
    return 'Estoy listo para ayudarte con precios, ventas, catalogo y decisiones de tu negocio.'
  }

  return lastAssistantMessage.value || 'Tu conversacion sigue abierta. Puedes retomarla cuando quieras.'
})

onMounted(() => {
  isCollapsed.value = localStorage.getItem(COLLAPSED_KEY) === '1'
  isChatOpen.value = localStorage.getItem(CHAT_OPEN_KEY) === '1'

  if (isChatOpen.value) {
    void loadLatestConversation()
  }
})

watch(messages, () => {
  void nextTick(scrollToBottom)
}, { deep: true })

function setCollapsed(value: boolean) {
  isCollapsed.value = value
  localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0')

  if (value) {
    isChatOpen.value = false
    localStorage.setItem(CHAT_OPEN_KEY, '0')
  }
}

function openChat(prompt?: string) {
  isCollapsed.value = false
  isChatOpen.value = true
  localStorage.setItem(COLLAPSED_KEY, '0')
  localStorage.setItem(CHAT_OPEN_KEY, '1')

  if (prompt) {
    void loadLatestConversation().finally(() => sendMessage(prompt))
  } else {
    void loadLatestConversation().finally(() => nextTick(scrollToBottom))
  }
}

function closeChatToPreview() {
  isChatOpen.value = false
  localStorage.setItem(CHAT_OPEN_KEY, '0')
}

function scrollToBottom() {
  if (!messagesEl.value) {
    return
  }

  messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function parseInlineFormatting(value: string): MessageInline[] {
  const parts: MessageInline[] = []
  const pattern = /\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        text: value.slice(lastIndex, match.index),
        bold: false,
      })
    }

    parts.push({
      text: match[1],
      bold: true,
    })

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < value.length) {
    parts.push({
      text: value.slice(lastIndex),
      bold: false,
    })
  }

  return parts.length ? parts : [{ text: value, bold: false }]
}

function parseMessageBlocks(value: string): MessageBlock[] {
  const blocks: MessageBlock[] = []
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  let paragraph: string[] = []
  let listItems: MessageInline[][] = []
  let listOrdered = false

  function flushParagraph() {
    if (!paragraph.length) {
      return
    }

    blocks.push({
      type: 'paragraph',
      parts: parseInlineFormatting(paragraph.join(' ')),
    })
    paragraph = []
  }

  function flushList() {
    if (!listItems.length) {
      return
    }

    blocks.push({
      type: 'list',
      ordered: listOrdered,
      items: listItems,
    })
    listItems = []
    listOrdered = false
  }

  for (const line of lines) {
    const unorderedMatch = line.match(/^[-*]\s+(.+)$/)
    const orderedMatch = line.match(/^\d+[.)]\s+(.+)$/)

    if (unorderedMatch || orderedMatch) {
      flushParagraph()

      const ordered = Boolean(orderedMatch)
      if (listItems.length && listOrdered !== ordered) {
        flushList()
      }

      listOrdered = ordered
      listItems.push(parseInlineFormatting((orderedMatch?.[1] ?? unorderedMatch?.[1] ?? '').trim()))
      continue
    }

    flushList()
    paragraph.push(line)
  }

  flushParagraph()
  flushList()

  return blocks.length ? blocks : [{ type: 'paragraph', parts: parseInlineFormatting(value) }]
}

async function loadLatestConversation() {
  if (historyLoaded.value || isLoadingHistory.value) {
    return
  }

  isLoadingHistory.value = true

  try {
    const response = await $fetch<{
      conversationId: string | null
      messages: ChatMessage[]
    }>('/api/kenchita/chat')

    conversationId.value = response.conversationId

    if (response.messages.length) {
      messages.value = response.messages
    }

    historyLoaded.value = true
  } catch {
    historyLoaded.value = true
  } finally {
    isLoadingHistory.value = false
  }
}

async function sendMessage(content = draft.value) {
  const message = content.trim()

  if (!message || isSending.value) {
    return
  }

  draft.value = ''
  isSending.value = true
  if (!isChatOpen.value) {
    openChat()
  }

  messages.value.push({
    id: makeId('user'),
    role: 'user',
    content: message,
  })

  const pendingId = makeId('assistant')
  messages.value.push({
    id: pendingId,
    role: 'assistant',
    content: 'Hmm...',
    pending: true,
  })

  try {
    const response = await $fetch<{
      conversationId: string
      reply: string
    }>('/api/kenchita/chat', {
      method: 'POST',
      body: {
        conversationId: conversationId.value,
        message,
      },
    })

    conversationId.value = response.conversationId
    const pendingMessage = messages.value.find((item) => item.id === pendingId)

    if (pendingMessage) {
      pendingMessage.content = response.reply
      pendingMessage.pending = false
    }
  } catch {
    const pendingMessage = messages.value.find((item) => item.id === pendingId)

    if (pendingMessage) {
      pendingMessage.content = 'No pude conectar con el servicio de IA en este momento. Contactate con soporte técnico 70707070.'
      pendingMessage.pending = false
    }
  } finally {
    isSending.value = false
  }
}

function onComposerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) {
    return
  }

  event.preventDefault()
  void sendMessage()
}
</script>

<template>
  <ClientOnly>
    <aside class="kenchita-chat" :class="{ 'is-collapsed': isCollapsed, 'is-open': isChatOpen }" aria-label="Asistente IA Kenchita">
      <Transition name="kenchita-state" mode="out-in">
        <section
          v-if="!isCollapsed && !isChatOpen"
          key="preview"
          class="kenchita-chat__preview"
          role="button"
          tabindex="0"
          aria-label="Abrir chat con Kenchita"
          @click="openChat()"
          @keydown.enter.prevent="openChat()"
          @keydown.space.prevent="openChat()"
        >
          <button
            type="button"
            class="kenchita-chat__close"
            aria-label="Cerrar asistente Kenchita"
            title="Cerrar"
            @click.stop="setCollapsed(true)"
          >
            <i class="pi pi-times" aria-hidden="true" />
          </button>

          <span class="kenchita-chat__avatar-wrap" aria-hidden="true">
            <img src="/kenchita-chat.png" alt="" class="kenchita-chat__avatar">
          </span>

          <div class="kenchita-chat__message">
            <span class="kenchita-chat__status">
              <span class="kenchita-chat__dot" aria-hidden="true" />
              Kenchita IA
            </span>
            <strong>{{ hasActiveConversation ? 'Chat en curso' : 'Hola, soy Kenchita' }}</strong>
            <p>{{ previewDescription }}</p>
            <span v-if="hasActiveConversation" class="kenchita-chat__resume">
              <i class="pi pi-comments" aria-hidden="true" />
              Continuar chat
            </span>
            <div v-if="!hasActiveConversation" class="kenchita-chat__chips" aria-label="Consultas rapidas">
              <button
                v-for="prompt in quickPrompts"
                :key="prompt"
                type="button"
                class="kenchita-chat__chip"
                @click.stop="openChat(prompt)"
              >
                {{ prompt }}
              </button>
            </div>
          </div>
        </section>

        <section v-else-if="isChatOpen" key="chat" class="kenchita-chat__window">
          <header class="kenchita-chat__header">
            <span class="kenchita-chat__header-avatar" aria-hidden="true">
              <img src="/kenchita-chat.png" alt="">
            </span>
            <span class="kenchita-chat__header-copy">
              <strong>{{ chatTitle }}</strong>
              <small><span class="kenchita-chat__dot" aria-hidden="true" />Asesor empresarial para tu tienda</small>
            </span>
            <button type="button" aria-label="Minimizar chat" title="Minimizar" @click="closeChatToPreview">
              <i class="pi pi-minus" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Cerrar chat" title="Cerrar" @click="setCollapsed(true)">
              <i class="pi pi-times" aria-hidden="true" />
            </button>
          </header>

          <div ref="messagesEl" class="kenchita-chat__messages" aria-live="polite">
            <article
              v-for="message in messages"
              :key="message.id"
              class="kenchita-chat__bubble"
              :class="[`is-${message.role}`, { 'is-pending': message.pending }]"
            >
              <span v-if="message.role === 'assistant'" class="kenchita-chat__bubble-avatar" aria-hidden="true">
                <img src="/kenchita-chat.png" alt="">
              </span>
              <div v-if="!message.pending" class="kenchita-chat__bubble-content">
                <template
                  v-for="(block, blockIndex) in parseMessageBlocks(message.content)"
                  :key="`${message.id}-${blockIndex}`"
                >
                  <p v-if="block.type === 'paragraph'">
                    <template
                      v-for="(part, partIndex) in block.parts"
                      :key="`${message.id}-${blockIndex}-${partIndex}`"
                    >
                      <strong v-if="part.bold">{{ part.text }}</strong>
                      <span v-else>{{ part.text }}</span>
                    </template>
                  </p>
                  <ol v-else-if="block.ordered">
                    <li
                      v-for="(item, itemIndex) in block.items"
                      :key="`${message.id}-${blockIndex}-${itemIndex}`"
                    >
                      <template
                        v-for="(part, partIndex) in item"
                        :key="`${message.id}-${blockIndex}-${itemIndex}-${partIndex}`"
                      >
                        <strong v-if="part.bold">{{ part.text }}</strong>
                        <span v-else>{{ part.text }}</span>
                      </template>
                    </li>
                  </ol>
                  <ul v-else>
                    <li
                      v-for="(item, itemIndex) in block.items"
                      :key="`${message.id}-${blockIndex}-${itemIndex}`"
                    >
                      <template
                        v-for="(part, partIndex) in item"
                        :key="`${message.id}-${blockIndex}-${itemIndex}-${partIndex}`"
                      >
                        <strong v-if="part.bold">{{ part.text }}</strong>
                        <span v-else>{{ part.text }}</span>
                      </template>
                    </li>
                  </ul>
                </template>
              </div>
              <p v-else class="kenchita-chat__typing" aria-label="Kenchita esta escribiendo">
                <span>{{ message.content }}</span>
                <i aria-hidden="true" />
                <i aria-hidden="true" />
                <i aria-hidden="true" />
              </p>
            </article>
          </div>

          <div v-if="!hasActiveConversation" class="kenchita-chat__suggestions" aria-label="Sugerencias de consulta">
            <button
              v-for="prompt in quickPrompts"
              :key="prompt"
              type="button"
              :disabled="isSending"
              @click="sendMessage(prompt)"
            >
              {{ prompt }}
            </button>
          </div>

          <form class="kenchita-chat__composer" @submit.prevent="sendMessage()">
            <textarea
              v-model="draft"
              rows="1"
              placeholder="Escribe tu pregunta..."
              aria-label="Mensaje para Kenchita"
              :disabled="isSending"
              @keydown="onComposerKeydown"
            />
            <button type="submit" :disabled="!draft.trim() || isSending" aria-label="Enviar mensaje">
              <i class="pi pi-send" aria-hidden="true" />
            </button>
          </form>
        </section>

        <button
          v-else
          key="launcher"
          type="button"
          class="kenchita-chat__launcher"
          aria-label="Abrir asistente Kenchita"
          title="Abrir Kenchita IA"
          @click="setCollapsed(false)"
        >
          <span class="kenchita-chat__launcher-crop" aria-hidden="true">
            <img src="/kenchita-chat.png" alt="" class="kenchita-chat__launcher-avatar">
          </span>
          <span class="kenchita-chat__launcher-pulse" aria-hidden="true" />
        </button>
      </Transition>
    </aside>
  </ClientOnly>
</template>

<style scoped>
.kenchita-chat {
  position: fixed;
  right: max(18px, env(safe-area-inset-right));
  bottom: max(18px, env(safe-area-inset-bottom));
  z-index: 2147483000;
  max-width: calc(100vw - 32px);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  pointer-events: none;
  isolation: isolate;
}

.kenchita-chat__preview,
.kenchita-chat__window,
.kenchita-chat__launcher {
  pointer-events: auto;
}

.kenchita-chat__preview {
  position: relative;
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  width: min(386px, calc(100vw - 32px));
  min-height: 132px;
  padding: 16px 42px 16px 15px;
  border: 1px solid rgba(15, 158, 46, 0.2);
  border-radius: 24px 24px 8px 24px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(247, 253, 248, 0.96)),
    radial-gradient(circle at 0% 0%, rgba(47, 224, 74, 0.16), transparent 42%);
  box-shadow: 0 20px 48px rgba(4, 32, 13, 0.18);
  backdrop-filter: blur(14px);
  cursor: pointer;
}

.kenchita-chat__close,
.kenchita-chat__header button {
  display: grid;
  place-items: center;
  border: 0;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.kenchita-chat__close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #eef7ef;
  color: #31523a;
}

.kenchita-chat__close:hover,
.kenchita-chat__header button:hover {
  background: #dcfce5;
  color: #0a6f1f;
  transform: translateY(-1px);
}

.kenchita-chat__avatar-wrap {
  align-self: center;
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  border: 3px solid #ffffff;
  border-radius: 999px;
  background: linear-gradient(145deg, #eaffef, #bdf3cb);
  box-shadow:
    0 10px 24px rgba(15, 158, 46, 0.2),
    inset 0 -8px 14px rgba(10, 111, 31, 0.12);
  overflow: hidden;
}

.kenchita-chat__avatar {
  width: 68px;
  height: 63px;
  object-fit: contain;
  transform: translateY(3px);
}

.kenchita-chat__message {
  min-width: 0;
  color: #0b1f3a;
  overflow-wrap: anywhere;
}

.kenchita-chat__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
  color: #0a6f1f;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.kenchita-chat__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.16);
}

.kenchita-chat__message strong {
  display: block;
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1rem;
  font-weight: 900;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.kenchita-chat__message p {
  margin: 5px 0 11px;
  color: #5f6d7e;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}

.kenchita-chat__resume {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  color: #0a6f1f;
  font-size: 0.76rem;
  font-weight: 900;
}

.kenchita-chat__resume i {
  font-size: 0.8rem;
}

.kenchita-chat__chips,
.kenchita-chat__suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.kenchita-chat__chip,
.kenchita-chat__suggestions button {
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(15, 158, 46, 0.2);
  border-radius: 999px;
  background: #ffffff;
  color: #0a6f1f;
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
}

.kenchita-chat__chip:hover,
.kenchita-chat__suggestions button:hover:not(:disabled) {
  border-color: rgba(15, 158, 46, 0.45);
  background: #effdf3;
  transform: translateY(-1px);
}

.kenchita-chat__window {
  display: grid;
  width: min(420px, calc(100vw - 32px));
  height: min(640px, calc(100dvh - 36px));
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  overflow: hidden;
  border: 1px solid rgba(15, 158, 46, 0.22);
  border-radius: 22px 22px 8px 22px;
  background: #ffffff;
  box-shadow: 0 24px 60px rgba(4, 32, 13, 0.24);
}

.kenchita-chat__header {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 34px 34px;
  align-items: center;
  gap: 10px;
  padding: 14px;
  background:
    linear-gradient(135deg, rgba(8, 72, 24, 0.96), rgba(10, 111, 31, 0.94)),
    #084818;
  color: #ffffff;
}

.kenchita-chat__header-avatar,
.kenchita-chat__bubble-avatar,
.kenchita-chat__launcher-crop {
  display: grid;
  place-items: center;
  border-radius: 999px;
  overflow: hidden;
}

.kenchita-chat__header-avatar {
  width: 46px;
  height: 46px;
  background: #eaffef;
  border: 2px solid rgba(255, 255, 255, 0.76);
}

.kenchita-chat__header-avatar img {
  width: 52px;
  height: 48px;
  object-fit: contain;
  transform: translateY(3px);
}

.kenchita-chat__header-copy {
  min-width: 0;
}

.kenchita-chat__header-copy strong,
.kenchita-chat__header-copy small {
  display: block;
}

.kenchita-chat__header-copy strong {
  font-family: "Plus Jakarta Sans", "Inter", sans-serif;
  font-size: 1rem;
  font-weight: 900;
}

.kenchita-chat__header-copy small {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #dffce7;
  font-size: 0.75rem;
  font-weight: 700;
}

.kenchita-chat__header button {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

.kenchita-chat__messages {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 16px;
  overflow-y: auto;
  background:
    linear-gradient(180deg, rgba(236, 253, 240, 0.72), rgba(255, 255, 255, 0.96)),
    #ffffff;
}

.kenchita-chat__bubble {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  max-width: 90%;
}

.kenchita-chat__bubble-content,
.kenchita-chat__bubble p {
  margin: 0;
  padding: 10px 12px;
  border-radius: 16px;
  color: #0b1f3a;
  font-size: 0.86rem;
  font-weight: 450;
  line-height: 1.45;
}

.kenchita-chat__bubble-content p {
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
}

.kenchita-chat__bubble-content p + p,
.kenchita-chat__bubble-content p + ul,
.kenchita-chat__bubble-content p + ol,
.kenchita-chat__bubble-content ul + p,
.kenchita-chat__bubble-content ol + p {
  margin-top: 8px;
}

.kenchita-chat__bubble-content strong {
  color: #031f0b;
  font-weight: 750;
}

.kenchita-chat__bubble-content ul,
.kenchita-chat__bubble-content ol {
  display: grid;
  gap: 6px;
  margin: 8px 0 0;
  padding: 0 0 0 18px;
}

.kenchita-chat__bubble-content li {
  padding-left: 2px;
}

.kenchita-chat__bubble-content li::marker {
  color: #0f9e2e;
  font-weight: 800;
}

.kenchita-chat__bubble.is-assistant {
  align-self: flex-start;
}

.kenchita-chat__bubble.is-assistant .kenchita-chat__bubble-content,
.kenchita-chat__bubble.is-assistant > p {
  border-bottom-left-radius: 5px;
  background: #ffffff;
  border: 1px solid #dbeee0;
}

.kenchita-chat__bubble.is-user {
  align-self: flex-end;
  justify-content: flex-end;
}

.kenchita-chat__bubble.is-user .kenchita-chat__bubble-content,
.kenchita-chat__bubble.is-user > p {
  border-bottom-right-radius: 5px;
  background: #0f9e2e;
  color: #ffffff;
}

.kenchita-chat__bubble.is-user .kenchita-chat__bubble-content strong {
  color: #ffffff;
}

.kenchita-chat__bubble.is-pending > p {
  color: #64748b;
}

.kenchita-chat__typing {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.kenchita-chat__typing span {
  margin-right: 2px;
}

.kenchita-chat__typing i {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #22c55e;
  animation: kenchita-typing 1s ease-in-out infinite;
}

.kenchita-chat__typing i:nth-child(3) {
  animation-delay: 0.15s;
}

.kenchita-chat__typing i:nth-child(4) {
  animation-delay: 0.3s;
}

.kenchita-chat__bubble-avatar {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  background: #eaffef;
  border: 1px solid #c6f6d5;
}

.kenchita-chat__bubble-avatar img {
  width: 32px;
  height: 30px;
  object-fit: contain;
  transform: translateY(2px);
}

.kenchita-chat__suggestions {
  flex-wrap: nowrap;
  gap: 7px;
  padding: 10px 12px 0;
  border-top: 1px solid #e8f2ea;
  background: #ffffff;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: #bfeac8 transparent;
}

.kenchita-chat__suggestions button {
  flex: 0 0 auto;
  white-space: nowrap;
}

.kenchita-chat__suggestions button:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

.kenchita-chat__composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 42px;
  gap: 8px;
  padding: 12px;
  background: #ffffff;
}

.kenchita-chat__composer textarea {
  width: 100%;
  min-height: 42px;
  max-height: 110px;
  resize: none;
  border: 1px solid #dbeee0;
  border-radius: 14px;
  padding: 11px 12px;
  color: #0b1f3a;
  background: #f8fcf9;
  outline: 0;
}

.kenchita-chat__composer textarea:focus {
  border-color: #35d35c;
  box-shadow: 0 0 0 3px rgba(53, 211, 92, 0.16);
}

.kenchita-chat__composer button {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 0;
  border-radius: 14px;
  background: #0f9e2e;
  color: #ffffff;
  cursor: pointer;
}

.kenchita-chat__composer button:disabled {
  background: #a7d9b2;
  cursor: not-allowed;
}

.kenchita-chat__launcher {
  position: relative;
  display: grid;
  width: 68px;
  height: 68px;
  place-items: center;
  border: 3px solid #ffffff;
  border-radius: 999px;
  background: linear-gradient(145deg, #dffce7, #86e89b);
  box-shadow: 0 16px 36px rgba(4, 32, 13, 0.24);
  cursor: pointer;
}

.kenchita-chat__launcher-crop {
  position: relative;
  z-index: 1;
  width: 62px;
  height: 62px;
}

.kenchita-chat__launcher-avatar {
  width: 72px;
  height: 66px;
  object-fit: contain;
  transform: translateY(4px);
}

.kenchita-chat__launcher-pulse {
  position: absolute;
  right: 5px;
  top: 6px;
  width: 15px;
  height: 15px;
  border: 3px solid #ffffff;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.42);
  animation: kenchita-pulse 1.8s ease-out infinite;
}

.kenchita-state-enter-active,
.kenchita-state-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.kenchita-state-enter-from,
.kenchita-state-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

@keyframes kenchita-pulse {
  70% {
    box-shadow: 0 0 0 12px rgba(34, 197, 94, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
}

@keyframes kenchita-typing {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }

  40% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

@media (max-width: 640px) {
  .kenchita-chat {
    right: 12px;
    bottom: 12px;
  }

  .kenchita-chat__preview {
    grid-template-columns: 58px minmax(0, 1fr);
    width: calc(100vw - 24px);
    padding: 13px 38px 13px 12px;
    border-radius: 20px 20px 8px 20px;
  }

  .kenchita-chat__avatar-wrap {
    width: 52px;
    height: 52px;
  }

  .kenchita-chat__avatar {
    width: 57px;
    height: 53px;
  }

  .kenchita-chat__chips {
    gap: 5px;
  }

  .kenchita-chat__message p {
    margin-bottom: 8px;
    -webkit-line-clamp: 2;
  }

  .kenchita-chat__window {
    width: calc(100vw - 24px);
    height: min(620px, calc(100dvh - 24px));
  }
}
</style>
