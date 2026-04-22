## 遷移前程式碼狀態快照
生成時間：Tue Apr 21 12:38:04 CST 2026

### 遷移前測試結果

> @ladder-room/shared@0.1.0 test
> vitest run


 RUN  v1.6.1 /Users/tobala/projects/climb_stairs/packages/shared

 ✓ src/prng/__tests__/djb2.test.ts  (10 tests) 3ms
 ✓ src/prng/__tests__/fisherYates.test.ts  (9 tests) 7ms
 ✓ src/prng/__tests__/mulberry32.test.ts  (8 tests) 18ms
 ✓ src/use-cases/__tests__/GenerateLadder.test.ts  (17 tests) 13ms
 ✓ src/use-cases/__tests__/ValidateGameStart.test.ts  (17 tests) 19ms
 ✓ src/use-cases/__tests__/ComputeResults.test.ts  (17 tests) 44ms

 Test Files  6 passed (6)
      Tests  78 passed (78)
   Start at  12:38:05
   Duration  440ms (transform 238ms, setup 0ms, collect 386ms, tests 104ms, environment 1ms, prepare 513ms)


> @ladder-room/server@0.1.0 test
> vitest run


 RUN  v1.6.1 /Users/tobala/projects/climb_stairs/packages/server

 ✓ src/__tests__/unit/RoomService.test.ts  (31 tests) 19ms
 ✓ src/__tests__/unit/GameService.test.ts  (62 tests) 18ms

 Test Files  2 passed (2)
      Tests  93 passed (93)
   Start at  12:38:06
   Duration  423ms (transform 135ms, setup 0ms, collect 203ms, tests 37ms, environment 0ms, prepare 119ms)


### 現有測試檔案清單
./packages/server/dist/__tests__/unit/GameService.test.d.ts
./packages/server/dist/__tests__/unit/GameService.test.js
./packages/server/dist/__tests__/unit/GameService.test.js.map
./packages/server/dist/__tests__/unit/RoomService.test.d.ts
./packages/server/dist/__tests__/unit/RoomService.test.js
./packages/server/dist/__tests__/unit/RoomService.test.js.map
./packages/server/src/__tests__/unit/GameService.test.ts
./packages/server/src/__tests__/unit/RoomService.test.ts
./packages/shared/dist/prng/__tests__/djb2.test.d.ts
./packages/shared/dist/prng/__tests__/djb2.test.d.ts.map
./packages/shared/dist/prng/__tests__/djb2.test.js
./packages/shared/dist/prng/__tests__/djb2.test.js.map
./packages/shared/dist/prng/__tests__/fisherYates.test.d.ts
./packages/shared/dist/prng/__tests__/fisherYates.test.d.ts.map
./packages/shared/dist/prng/__tests__/fisherYates.test.js
./packages/shared/dist/prng/__tests__/fisherYates.test.js.map
./packages/shared/dist/prng/__tests__/mulberry32.test.d.ts
./packages/shared/dist/prng/__tests__/mulberry32.test.d.ts.map
./packages/shared/dist/prng/__tests__/mulberry32.test.js
./packages/shared/dist/prng/__tests__/mulberry32.test.js.map
./packages/shared/dist/use-cases/__tests__/ComputeResults.test.d.ts
./packages/shared/dist/use-cases/__tests__/ComputeResults.test.d.ts.map
./packages/shared/dist/use-cases/__tests__/ComputeResults.test.js
./packages/shared/dist/use-cases/__tests__/ComputeResults.test.js.map
./packages/shared/dist/use-cases/__tests__/GenerateLadder.test.d.ts
./packages/shared/dist/use-cases/__tests__/GenerateLadder.test.d.ts.map
./packages/shared/dist/use-cases/__tests__/GenerateLadder.test.js
./packages/shared/dist/use-cases/__tests__/GenerateLadder.test.js.map
./packages/shared/dist/use-cases/__tests__/ValidateGameStart.test.d.ts
./packages/shared/dist/use-cases/__tests__/ValidateGameStart.test.d.ts.map
./packages/shared/dist/use-cases/__tests__/ValidateGameStart.test.js
./packages/shared/dist/use-cases/__tests__/ValidateGameStart.test.js.map
./packages/shared/src/prng/__tests__/djb2.test.ts
./packages/shared/src/prng/__tests__/fisherYates.test.ts
./packages/shared/src/prng/__tests__/mulberry32.test.ts
./packages/shared/src/use-cases/__tests__/ComputeResults.test.ts
./packages/shared/src/use-cases/__tests__/GenerateLadder.test.ts
./packages/shared/src/use-cases/__tests__/ValidateGameStart.test.ts
./scripts/load_test.js
./scripts/run_load_test.ps1
./scripts/run_load_test.sh
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > kickPlayer > throws PLAYER_NOT_FOUND when target does not exist
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > kickPlayer > throws CANNOT_KICK_SELF when host tries to kick themselves
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > resetRoom > throws NOT_HOST when caller is not the host
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > resetRoom > throws INVALID_STATE when room is not finished
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > resetRoom > throws INSUFFICIENT_ONLINE_PLAYERS when fewer than 2 online players remain
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > resetRoom > resets room to waiting state with online players when valid
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > resetRoom > keeps offline host player when resetting, removes offline non-host players
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > resetRoom > sets winnerCount to null when old winnerCount >= new player count (AC-H02-3)
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > resetRoom > preserves winnerCount when it is still valid for the new player count
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > resetRoom > calls clearKickedPlayers when resetting room
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > resetRoom > retains offline host when resetting (host always kept regardless of online status)
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > endGame > throws NOT_HOST when caller is not the host
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > endGame > throws INVALID_STATE when room is not in revealing state
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > endGame > throws INVALID_STATE when room is in waiting state
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > endGame > transitions room to finished state from revealing
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > endGame > throws ROOM_NOT_FOUND when room does not exist
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > endGame > throws INVALID_STATE when room is already finished (idempotency guard)
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > endGame > throws REVEALS_INCOMPLETE when not all results have been revealed (FR-04-1)
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > endGame > allows endGame when all results have been revealed (revealedCount === results.length)
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > playAgain > throws NOT_HOST when caller is not the host
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > playAgain > throws INVALID_STATE when room is not in finished state
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > playAgain > throws INSUFFICIENT_ONLINE_PLAYERS when fewer than 2 online players remain
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > playAgain > resets room to waiting state retaining only online players
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > playAgain > sets winnerCount to null when old winnerCount >= new player count
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > playAgain > clears kicked player list when resetting
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > playAgain > throws ROOM_NOT_FOUND when room does not exist
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > playAgain > retains offline host in playAgain (host always kept regardless of online status)
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > playAgain > preserves winnerCount when still valid after pruning (winnerCount < new player count)
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > missing room > throws ROOM_NOT_FOUND when room does not exist (startGame)
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > missing room > throws ROOM_NOT_FOUND when room does not exist (beginReveal)
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > missing room > throws ROOM_NOT_FOUND when room does not exist (revealNext)
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > missing room > throws ROOM_NOT_FOUND when room does not exist (revealAll)
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > missing room > throws ROOM_NOT_FOUND when room does not exist (resetRoom)
 ✓ packages/server/src/__tests__/unit/GameService.test.ts > GameService > missing room > throws ROOM_NOT_FOUND when room does not exist (kickPlayer)

 Test Files  8 passed (8)
      Tests  171 passed (171)
   Start at  12:38:13
   Duration  682ms (transform 434ms, setup 0ms, collect 757ms, tests 138ms, environment 1ms, prepare 972ms)

