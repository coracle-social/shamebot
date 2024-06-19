<script lang="ts">
  import {nip19} from 'nostr-tools'
  import {onMount} from 'svelte'
  import {fly} from 'svelte/transition'
  import {get, derived, writable} from 'svelte/store'
  import {seconds, quantify} from "hurdak"
  import {sortBy, uniqBy, now, first, max} from '@welshman/lib'
  import Skeleton from './Skeleton.svelte'
  import {profiles, loadData, createScroller, contentRelays} from './core'

  const {locale} = new Intl.DateTimeFormat().resolvedOptions()

  const formatter = new Intl.DateTimeFormat(locale, {dateStyle: "short", timeStyle: "short"})

  const formatTimestamp = (ts: number) => formatter.format(new Date(ts * 1000))

  const formatTimestampRelative = (ts: number) => {
    let unit
    let delta = now() - ts
    if (delta < seconds(1, "minute")) {
      unit = "second"
    } else if (delta < seconds(1, "hour")) {
      unit = "minute"
      delta = Math.round(delta / seconds(1, "minute"))
    } else if (delta < seconds(2, "day")) {
      unit = "hour"
      delta = Math.round(delta / seconds(1, "hour"))
    } else {
      unit = "day"
      delta = Math.round(delta / seconds(1, "day"))
    }

    const locale = new Intl.RelativeTimeFormat().resolvedOptions().locale
    const formatter = new Intl.RelativeTimeFormat(locale, {
      numeric: "auto",
    })

    return formatter.format(-delta, unit as Intl.RelativeTimeFormatUnit)
  }

  const njump = (path: string) => `https://njump.me/${path}`

  const njumpEvent = (id: string) => njump(nip19.neventEncode({id, relays: contentRelays}))

  const njumpProfile = (pubkey: string) => njump(nip19.nprofileEncode({pubkey, relays: contentRelays}))

  const promise = loadData()

  const loadMore = async () => {
    limit += 20
  }

  const getItems = events =>
    uniqBy(
      item => item.pubkey + item.term,
      events
        .map(e => ({
          id: e.id,
          pubkey: e.pubkey,
          term: e.tags.find(t => t[0] === "i")?.[1],
        }))
        .filter(item => item.term)
    )

  let element: any
  let limit = 20

  onMount(() => {
    createScroller(loadMore, {element})
  })
</script>

<main class="bg-base-200 min-h-screen">
  <div class="p-20 pt-4 flex flex-col gap-4" bind:this={element}>
    {#await promise}
      <div class="loading loading-spinner loading-lg m-auto my-20" />
    {:then events}
      {#each getItems(events.slice(0, limit)) as item (item.id)}
        {@const profile = $profiles.get(item.pubkey)}
        <div in:fly={{y: 20}} class="card bg-base-100 shadow-xl">
          <div class="card-body flex-row justify-between">
            <div class="flex gap-2 items-start">
              <div class="shrink-0 w-6 h-6 rounded-full bg-gray-700 bg-cover bg-center overflow-hidden">
                <img alt="" src={profile?.picture} />
              </div>
              <a class="font-bold" target="_blank" href={njumpProfile(item.pubkey)}>
                {profile?.display_name || profile?.name || item.pubkey.slice(0, 8)}
              </a>
              <p>
                searched for "{item.term}"
              </p>
            </div>
          </div>
        </div>
      {/each}
    {/await}
  </div>
</main>
