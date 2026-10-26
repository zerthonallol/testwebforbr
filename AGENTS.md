<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Brainrot data in src/data/brainrots.ts is generated from Steal a Brainrot wiki categories; `rarityScore` drives `price`, so regenerate rather than hand-edit prices.
- Player state is saved via src/lib/player.functions.ts keyed by Telegram id, verified with Telegram initData HMAC (TELEGRAM_BOT_TOKEN); localStorage is only a fast local backup.
- Owner-only actions (global price overrides, update banner, backups) live in src/lib/owner.functions.ts and are verified server-side via Telegram initData; the owner id is in src/lib/tg-auth.ts.
- Global UI state that memoized cards need (streamer mode, price overrides) lives in src/lib/live.ts as an external store; overrides mutate brainrot objects in place.
- Developer gifts (coins/cases) are queued in `pending_grants` and claimed by the client store, because player state is a client-saved blob the server must not overwrite.
- Live feed shows only real drops from `live_drops`, reported when a brainrot is granted with a source; never reintroduce fake feed items.
- Maintenance mode (`app_settings.maintenance`) hides the app for everyone except the owner id.
- Battle pass is level-based (src/data/battlepass.ts, pure functions): quests only grant XP once, XP sets the level, each level has a free and a premium reward. Why: one place for the rules, covered by tests.
- "Best drop in 24h" is computed server-side from `live_drops` by brainrot price (getBestDrop24h). Why: only real drops, same as the live feed.
- Navigation is a top-left corner menu (src/routes/index.tsx), not a bottom bar; every tab must be added to TABS so it appears there.
- Backups are versioned JSON (`app: "brainrotdrop"`) of players, promo codes, unclaimed grants and price overrides; imports are chunked and bump `state.savedAt` so the restored copy wins over device caches.
- tsconfig keeps noUncheckedIndexedAccess/exactOptionalPropertyTypes off to match the original BrainrotDrop codebase.

- Case chances/contents: static defaults live in `src/data/cases.ts`; owner edits are stored as `app_settings.case_overrides` and applied in place via `buildEntries`/`applyCaseOverrides`. Why: every client sees the same odds without redeploying.
- Deposit/withdraw requests are stored server-side in `transfer_requests` (keyed by player tg_id + client id); clients poll and apply admin decisions once. Why: the owner must review them and the bot notifies both sides.
- Sounds are synthesized in `src/lib/sound.ts` and fired from `notify()`/medium `haptic()`; light taps stay silent. Why: owner asked for event sounds but no click sounds.
- Upgrader odds (max chance, house edge) and quick-pick presets live in src/data/upgrader.ts as pure functions. Why: one place for the rules, covered by tests.
- The free case requires a Telegram channel subscription verified server-side via Bot API getChatMember (src/lib/subscription.functions.ts). Why: client-side checks are trivially bypassed; the bot must be a channel admin.
- Case covers are `/img/cases/<id>-v2.webp` chest art with the case's star brainrot baked in and its own white sticker outline, so tiles must not add the `.bd-sticker` outline or peek extra brainrots. Why: covers were redrawn as one Steal a Brainrot style set.
- The beginner tour (src/components/casino/Onboarding.tsx) opens once per device (localStorage `brainrotdice:tour-done`) and is reopened from the corner menu and hero. Why: newcomers see it without a backend change; existing `brainrotdrop:*` storage keys stay so old saves load.
