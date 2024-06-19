import {throttle} from 'throttle-debounce'
import {writable, get} from 'svelte/store'
import {assoc, batch, sleep, chunk, now} from '@welshman/lib'
import type {SignedEvent} from '@welshman/util'
import {isShareableRelayUrl} from '@welshman/util'
import {subscribe} from '@welshman/net'
import type {SubscribeRequest, Subscription} from '@welshman/net'

export const day = 86400

export const indexerRelays = [
  "wss://purplepag.es",
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
]

export const contentRelays = [
  "wss://relay.snort.social",
  "wss://relay.damus.io",
  "wss://offchain.pub",
  "wss://relay.f7z.io",
  "wss://dvms.f7z.io",
  "wss://nos.lol",
  "wss://relay.nostr.net",
  "wss://relay.nostr.band",
]

export type MySubscribeRequest = SubscribeRequest & {
  onEvent: (e: SignedEvent) => void
}

export const load = ({onEvent, ...request}: MySubscribeRequest) => {
  const sub = subscribe({immediate: true, timeout: 3000, closeOnEose: true, ...request})

  sub.emitter.on('event', (url, e) => onEvent(e))

  return sub.result
}

// Types

export type Profile = Record<string, any>

// State

export const profiles = writable(new Map<string, Profile>())

// Loaders

export const loadProfile = batch(500, (pubkeys: string[]) => {
  const $profiles = get(profiles)
  const authors = pubkeys.filter(pk => !$profiles.get(pk))

  if (authors.length > 0) {
    load({
      relays: indexerRelays,
      filters: [{authors, kinds: [0]}],
      onEvent: batch(300, (events: SignedEvent[]) => {
        profiles.update($p => {
          for (const e of events) {
            try {
              $p.set(e.pubkey, JSON.parse(e.content))
            } catch (e) {
              // pass
            }
          }

          return $p
        })
      }),
    })
  }
})

export const loadData = () =>
  load({
    relays: contentRelays,
    filters: [{kinds: [5302, 5303], since: now() - day * 30, limit: 1000}],
    onEvent: e => loadProfile(e.pubkey),
  })

// Utils

type ScrollerOpts = {
  delay?: number
  threshold?: number
  reverse?: boolean
  element?: Element
}

export const createScroller = (
  loadMore: () => Promise<void>,
  {delay = 500, threshold = 4000, reverse = false, element}: ScrollerOpts = {},
) => {
  let done = false
  const check = async () => {
    // While we have empty space, fill it
    const {scrollY, innerHeight} = window
    // @ts-ignore
    const {scrollHeight, scrollTop} = element
    const offset = Math.abs(scrollTop || scrollY)
    const shouldLoad = offset + innerHeight + threshold > scrollHeight

    // Only trigger loading the first time we reach the threshold
    if (shouldLoad) {
      await loadMore()
    }

    // No need to check all that often
    await sleep(delay)

    if (!done) {
      requestAnimationFrame(check)
    }
  }

  requestAnimationFrame(check)

  return {
    check,
    stop: () => {
      done = true
    },
  }
}
