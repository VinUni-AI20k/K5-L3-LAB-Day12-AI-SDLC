# Test Contract v1.0 — condensed spec (source: lab board, Phase 1)

Authoritative source is the lab board. This file is our working summary; agents read this instead of the board.

## Game (PRD-0, Phase 1 scope)
- 3D third-person. Player = Mây (leaf hat with small lantern). Night 1 "Đảo Bến": round island, 5 Great Lanterns.
- Collect fireflies (motes) → deposit into lanterns → lantern lit. All lit = win. Lose all flames (health) = lose. Score exists.
- Bóng Mực (shades) chase; contact costs flames. Pulse (light) pushes/stuns shades and costs light. Shades fear lanterns.
- Must have: move, jump, 3D camera, motes, deposit, shades, pulse, win/lose, score, HUD, replay.
- Extras allowed only if headless contract output is unchanged (disable extras in headless).

## A. `game.contract.json` (repo root)
Fields: `contract_version` "1.0", `team`, `build_cmd`, `run_cmd` (windowed), `headless_cmd` (args appended), `tuning`.
`tuning` must equal the numbers the game really uses (tests are generated from them). Unknown concept → `null`/`false` + README note.
Keys: player_speed, carry_capacity, lantern_cost, lantern_count_night1 (=5), pickup_radius, interact_radius, pulse_cost,
pulse_radius, night1_duration_s, flames, invuln_s, hit_drop_ratio, pulse_stun_s, pulse_push_m, pulse_cooldown_s,
safe_radius, shade_speed, shade_hit_radius, fall_enabled (bool),
score {per_mote, per_lantern, per_stun, per_second_left, per_flame_left}.
- hit_drop_ratio: fraction of carried motes dropped on hit (0 = none). safe_radius: shades can't enter around a lantern.
- fall_enabled: whether falling off the island is penalised.

## B. Headless CLI
`<headless_cmd> --seed <int> --night 1 [--scenario f.json] [--inputs f.json] --ticks <int> --out f.jsonl [--snapshot-every <int>=10]`
- Fixed 60 ticks/s, no window/GPU, run as fast as possible.
- Stop after `--ticks` steps or at game end. Exit 0. Other errors: non-zero + stderr. Malformed inputs/scenario: exit **2**.
- Metres, Y up, ground Y=0, player starts (0,0,0).
- Tick model: snapshot tick 0 = after scenario setup, before any input. Step k (0..N-1) reads input of tick k → state k+1;
  events in that step carry `tick = k+1`. `--ticks N` = exactly N steps. `time_left_s = duration − steps/60`.
- Positions: player = feet, shade = centre, lantern = base, mote = ground point. All tuning distances are horizontal (XZ),
  no body size added. "within r" means `dist <= r`.

## C. Inputs file `{ "frames": [ {tick, move?, cam_yaw_deg?, jump?, interact?, pulse?, dash?}, ... ] }`
- Defaults before first frame: move [0,0], cam_yaw_deg 0, buttons false. Frames change only fields present; others persist.
- Frame ticks strictly increasing. `move` = [x,z] each in [-1,1]; length > 1 → normalise.
- θ = cam_yaw_deg in radians: x' = x·cosθ + z·sinθ ; z' = −x·sinθ + z·cosθ (θ=0: x→+X, z→+Z).
- Buttons trigger on false→true edge. No inputs file → player stands still.

## D. Scenario file
`{ player:{pos,carried,flames}, random_motes, random_shades, motes:[[x,y,z]...], shades:[{pos,id?}], lanterns:[{id,pos?,deposited?,lit?}], time_left_s }`
- random_motes:false → only listed motes. random_shades:false → only listed shades, active immediately.
- lanterns update by id L1..L5; unmentioned unchanged. motes/shades REPLACE defaults ([] = none). Omitted fields → defaults.
- Setup emits no events and awards no score (pre-lit lantern gives no points).

## E. Output JSONL (one JSON object per line)
- snapshot every `--snapshot-every` ticks from tick 0:
  `{"type":"snapshot","tick","sim_tick"(=tick in v1),"state","time_left_s","score","player":{"pos","flames","carried"},"lanterns":[{"id","pos","lit","deposited"}],"shades":[{"id","pos","state"}],"motes_active"}`
  (optional `motes:[{id,pos}]`).
- event: `{"type":"event","tick":n,"name":...,"data":{...}}`
  mote_picked {carried} · deposit {lantern_id, amount, deposited} · lantern_lit {lantern_id} · pulse {stunned_ids}
  · player_hit {by:"shade"|"fall", flames, dropped} · shade_spawned {id} · game_over {result:"won"|"lost", reason:"all_lit"|"dawn"|"no_flames"}
  Omit events that cannot happen in our game.
- end (mandatory last line): `{"type":"end","ticks","state","score"}`
- state ∈ playing|won|lost. Shade states must include `stunned`. Coordinates rounded to 3 decimals.
- Determinism: same seed+scenario+inputs → byte-identical output, incl. generated ids.
