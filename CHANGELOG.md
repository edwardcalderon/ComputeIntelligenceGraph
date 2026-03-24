## [0.1.69](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.68...v0.1.69) (2026-03-24)


### Bug Fixes

* **landing:** remove legacy pages router to fix Next export build for GH Pages ([723591a](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/723591a5857ddb92466af63fab4c74f9f5415b1f))





## [0.1.68](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.65...v0.1.68) (2026-03-24)


### Bug Fixes

* align node 22 runtime and api migration packaging ([6928976](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/69289764d47b0660eb064beff09c6c288fd372fc))
* **api:** backfill legacy Supabase users schema ([b95c064](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/b95c0649485414d8c3f50e9071ead7bae68b25ee))
* **api:** pass subnet outputs into runtime deploy ([3195db9](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/3195db9b0098ee7f3a70d405726ff2cdd10a4edd))
* **api:** source auth inputs from live tenant ([2382f7d](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/2382f7da2746404c3efbed0832f7e7f489b685a0))
* **api:** unify publish and deploy pipeline ([e58848b](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/e58848b5fb5172ed9df9214217edbd7f10a14311))
* **ci:** handle missing sst stage in bootstrap diff ([f659714](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/f659714ad7dd26c72170f97982b5baa1589d361f))
* **ci:** remove browser auth dependency from api image ([6d01ad8](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/6d01ad82e4367d55f0b89d2601747fddc74d5acd))
* **ci:** remove workflow package resolution assumptions ([f73ac73](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/f73ac73be473a1080c96d8ef420996368f344bfd))
* **ci:** skip bootstrap diff when SST stage is absent ([55c649f](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/55c649f0e09fcef7a6adbc372348f4d894d727ce))
* **config:** add node types for docker builds ([25f0595](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/25f05956abc71adcbcd59fb54180d13dad6ae09c))
* **iac:** break neo4j terraform cycle ([8aadde3](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/8aadde311268cf45738cb2d8d31dee088fa89ea0))
* **iac:** raise ec2 root volumes for al2023 snapshots ([ea363d0](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/ea363d03a0fe96658979a8ab68a7d09d40fc2c2a))
* **infra:** attach ecs execution role policy by arn ([1806e36](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/1806e360e6e75c2e630324ca47b9c4aa669244b3))
* **infra:** clear workflow env in config test ([b634afc](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/b634afc01c175734bb21f5f839ec53cb85fad8a9))
* **infra:** make ecr lifecycle policy valid ([62acc47](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/62acc478c9340adb543d1db9e03f20f85752175d))
* **infra:** make sst config loader-safe ([66d99ad](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/66d99ad3ad44b42e80fa596bf4254e4f602af1c3))
* **infra:** move aws defaults to us-east-2 ([d3f01e9](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/d3f01e901d93582432370d11ad1e597b28a25c4c))





## [0.1.68](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.65...v0.1.68) (2026-03-24)


### Bug Fixes

* align node 22 runtime and api migration packaging ([6928976](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/69289764d47b0660eb064beff09c6c288fd372fc))
* **api:** backfill legacy Supabase users schema ([b95c064](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/b95c0649485414d8c3f50e9071ead7bae68b25ee))
* **api:** pass subnet outputs into runtime deploy ([3195db9](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/3195db9b0098ee7f3a70d405726ff2cdd10a4edd))
* **api:** source auth inputs from live tenant ([2382f7d](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/2382f7da2746404c3efbed0832f7e7f489b685a0))
* **api:** unify publish and deploy pipeline ([e58848b](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/e58848b5fb5172ed9df9214217edbd7f10a14311))
* **ci:** handle missing sst stage in bootstrap diff ([f659714](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/f659714ad7dd26c72170f97982b5baa1589d361f))
* **ci:** remove browser auth dependency from api image ([6d01ad8](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/6d01ad82e4367d55f0b89d2601747fddc74d5acd))
* **ci:** remove workflow package resolution assumptions ([f73ac73](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/f73ac73be473a1080c96d8ef420996368f344bfd))
* **ci:** skip bootstrap diff when SST stage is absent ([55c649f](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/55c649f0e09fcef7a6adbc372348f4d894d727ce))
* **config:** add node types for docker builds ([25f0595](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/25f05956abc71adcbcd59fb54180d13dad6ae09c))
* **iac:** break neo4j terraform cycle ([8aadde3](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/8aadde311268cf45738cb2d8d31dee088fa89ea0))
* **iac:** raise ec2 root volumes for al2023 snapshots ([ea363d0](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/ea363d03a0fe96658979a8ab68a7d09d40fc2c2a))
* **infra:** attach ecs execution role policy by arn ([1806e36](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/1806e360e6e75c2e630324ca47b9c4aa669244b3))
* **infra:** clear workflow env in config test ([b634afc](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/b634afc01c175734bb21f5f839ec53cb85fad8a9))
* **infra:** make ecr lifecycle policy valid ([62acc47](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/62acc478c9340adb543d1db9e03f20f85752175d))
* **infra:** make sst config loader-safe ([66d99ad](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/66d99ad3ad44b42e80fa596bf4254e4f602af1c3))
* **infra:** move aws defaults to us-east-2 ([d3f01e9](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/d3f01e901d93582432370d11ad1e597b28a25c4c))





## [0.1.67](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.65...v0.1.67) (2026-03-24)


### Bug Fixes

* align node 22 runtime and api migration packaging ([6928976](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/69289764d47b0660eb064beff09c6c288fd372fc))
* **api:** backfill legacy Supabase users schema ([b95c064](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/b95c0649485414d8c3f50e9071ead7bae68b25ee))
* **api:** pass subnet outputs into runtime deploy ([3195db9](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/3195db9b0098ee7f3a70d405726ff2cdd10a4edd))
* **api:** source auth inputs from live tenant ([2382f7d](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/2382f7da2746404c3efbed0832f7e7f489b685a0))
* **api:** unify publish and deploy pipeline ([e58848b](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/e58848b5fb5172ed9df9214217edbd7f10a14311))
* **ci:** handle missing sst stage in bootstrap diff ([f659714](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/f659714ad7dd26c72170f97982b5baa1589d361f))
* **ci:** remove browser auth dependency from api image ([6d01ad8](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/6d01ad82e4367d55f0b89d2601747fddc74d5acd))
* **ci:** remove workflow package resolution assumptions ([f73ac73](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/f73ac73be473a1080c96d8ef420996368f344bfd))
* **ci:** skip bootstrap diff when SST stage is absent ([55c649f](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/55c649f0e09fcef7a6adbc372348f4d894d727ce))
* **config:** add node types for docker builds ([25f0595](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/25f05956abc71adcbcd59fb54180d13dad6ae09c))
* **iac:** break neo4j terraform cycle ([8aadde3](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/8aadde311268cf45738cb2d8d31dee088fa89ea0))
* **iac:** raise ec2 root volumes for al2023 snapshots ([ea363d0](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/ea363d03a0fe96658979a8ab68a7d09d40fc2c2a))
* **infra:** attach ecs execution role policy by arn ([1806e36](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/1806e360e6e75c2e630324ca47b9c4aa669244b3))
* **infra:** clear workflow env in config test ([b634afc](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/b634afc01c175734bb21f5f839ec53cb85fad8a9))
* **infra:** make ecr lifecycle policy valid ([62acc47](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/62acc478c9340adb543d1db9e03f20f85752175d))
* **infra:** make sst config loader-safe ([66d99ad](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/66d99ad3ad44b42e80fa596bf4254e4f602af1c3))
* **infra:** move aws defaults to us-east-2 ([d3f01e9](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/d3f01e901d93582432370d11ad1e597b28a25c4c))





## [0.1.66](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.65...v0.1.66) (2026-03-24)





## [0.1.65](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.64...v0.1.65) (2026-03-24)


### Bug Fixes

* **dashboard:** include sdk in container build ([0365213](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/0365213aa8618f166a30218a840c6f315bc306b7))





## [0.1.65](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.64...v0.1.65) (2026-03-24)


### Bug Fixes

* **dashboard:** include sdk in container build ([0365213](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/0365213aa8618f166a30218a840c6f315bc306b7))





## [0.1.64](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.63...v0.1.64) (2026-03-24)


### Bug Fixes

* **api:** add explicit logout route rate-limit config ([775b147](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/775b14752dd4ebd3c831503faefcc4843d10161c))
* **api:** harden logout auth and unblock PR9 lint checks ([e8c9720](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/e8c972070896ec4d2022a04b393b8a52ba0ca87e))
* **api:** relax logout auth gate and keep explicit rate-limit metadata ([a0d441d](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/a0d441dfd0686dc02c0af03d0f059a55546dbc9a))
* **api:** use codeql-modeled fastify rate limiter on logout ([d0cead0](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/d0cead01efcbc16d0cefa4be20dad779b94cd842))
* **release:** ignore build metadata tags in prod workflows ([04c3a7e](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/04c3a7e349e8f95a7ac92d20b2297708280253f6))


### Features

* **api:** add token refresh endpoint and coverage ([4cdc329](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/4cdc329551fd39e5d2b2047a7604eb5514bce246))





## [0.1.63](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.62...v0.1.63) (2026-03-24)





## [0.1.63](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.62...v0.1.63) (2026-03-24)





## [0.1.62](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.61...v0.1.62) (2026-03-24)





## [0.1.62](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.61...v0.1.62) (2026-03-24)





## [0.1.61](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.60...v0.1.61) (2026-03-24)





## [0.1.61](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.60...v0.1.61) (2026-03-24)





## [0.1.60](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.59...v0.1.60) (2026-03-24)





## [0.1.60](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.59...v0.1.60) (2026-03-24)





## [0.1.59](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.58...v0.1.59) (2026-03-24)





## [0.1.59](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.58...v0.1.59) (2026-03-24)





## [0.1.58](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.57...v0.1.58) (2026-03-23)


### Features

* **dashboard:** unify device management page ([b2b69e1](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/b2b69e1090c478520ea78a0975e153c650da7d0a))





## [0.1.58](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.57...v0.1.58) (2026-03-23)


### Features

* **dashboard:** unify device management page ([b2b69e1](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/b2b69e1090c478520ea78a0975e153c650da7d0a))





## [0.1.57](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.54...v0.1.57) (2026-03-23)


### Bug Fixes

* **env:** redact secrets and obfuscate false positives ([1f506be](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/1f506be486248e9071d1823095146325bbbcf15e))





## [0.1.57](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.54...v0.1.57) (2026-03-23)


### Bug Fixes

* **env:** redact secrets and obfuscate false positives ([1f506be](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/1f506be486248e9071d1823095146325bbbcf15e))





## [0.1.56](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.54...v0.1.56) (2026-03-23)


### Bug Fixes

* **env:** redact secrets and obfuscate false positives ([1f506be](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/1f506be486248e9071d1823095146325bbbcf15e))





## [0.1.56](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.54...v0.1.56) (2026-03-23)


### Bug Fixes

* **env:** redact secrets and obfuscate false positives ([1f506be](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/1f506be486248e9071d1823095146325bbbcf15e))





## [0.1.55](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.54...v0.1.55) (2026-03-23)


### Bug Fixes

* **env:** redact secrets and obfuscate false positives ([1f506be](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/1f506be486248e9071d1823095146325bbbcf15e))





## [0.1.55](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.54...v0.1.55) (2026-03-23)


### Bug Fixes

* **env:** redact secrets and obfuscate false positives ([1f506be](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/1f506be486248e9071d1823095146325bbbcf15e))





## [0.1.54](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.53...v0.1.54) (2026-03-23)





## [0.1.54](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.53...v0.1.54) (2026-03-23)





## [0.1.53](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.52...v0.1.53) (2026-03-23)


### Features

* Authentik OIDC hardening, device session persistence, dashboard devices page, cartography scan service ([#7](https://github.com/edwardcalderon/ComputeIntelligenceGraph/issues/7)) ([5835322](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/58353226f65416b77f07868a0a932427c0f3c9b1))





## [0.1.53](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.52...v0.1.53) (2026-03-23)


### Features

* Authentik OIDC hardening, device session persistence, dashboard devices page, cartography scan service ([#7](https://github.com/edwardcalderon/ComputeIntelligenceGraph/issues/7)) ([5835322](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/58353226f65416b77f07868a0a932427c0f3c9b1))





## [0.1.52](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.51...v0.1.52) (2026-03-23)





## [0.1.52](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.51...v0.1.52) (2026-03-23)





## [0.1.51](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.50...v0.1.51) (2026-03-23)





## [0.1.51](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.50...v0.1.51) (2026-03-23)





## [0.1.50](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.49...v0.1.50) (2026-03-23)





## [0.1.50](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.49...v0.1.50) (2026-03-23)





## [0.1.49](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.48...v0.1.49) (2026-03-23)





## [0.1.49](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.48...v0.1.49) (2026-03-23)





## [0.1.48](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.47...v0.1.48) (2026-03-23)





## [0.1.48](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.47...v0.1.48) (2026-03-23)





## [0.1.47](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.46...v0.1.47) (2026-03-23)





## [0.1.47](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.46...v0.1.47) (2026-03-23)





## [0.1.46](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.45...v0.1.46) (2026-03-23)





## [0.1.46](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.45...v0.1.46) (2026-03-23)





## [0.1.45](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.44...v0.1.45) (2026-03-23)





## [0.1.45](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.44...v0.1.45) (2026-03-23)





## [0.1.44](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.43...v0.1.44) (2026-03-23)





## [0.1.44](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.43...v0.1.44) (2026-03-23)





## [0.1.43](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.42...v0.1.43) (2026-03-23)





## [0.1.43](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.42...v0.1.43) (2026-03-23)





## [0.1.42](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.41...v0.1.42) (2026-03-22)





## [0.1.42](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.41...v0.1.42) (2026-03-22)





## [0.1.41](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.40...v0.1.41) (2026-03-22)





## [0.1.41](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.40...v0.1.41) (2026-03-22)





## [0.1.40](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.39...v0.1.40) (2026-03-22)


### Bug Fixes

* **auth:** fully end Authentik browser sessions on logout ([69cb692](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/69cb69262123a5c6ed2fddf88d6d03986a52a60e))





## [0.1.40](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.39...v0.1.40) (2026-03-22)


### Bug Fixes

* **auth:** fully end Authentik browser sessions on logout ([69cb692](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/69cb69262123a5c6ed2fddf88d6d03986a52a60e))





## [0.1.39](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.38...v0.1.39) (2026-03-22)


### Bug Fixes

* **release:** validate dashboard container build ([2e1220b](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/2e1220b4b1bebcbf4ac438c7307bc572124383c4))





## [0.1.39](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.38...v0.1.39) (2026-03-22)


### Bug Fixes

* **release:** validate dashboard container build ([2e1220b](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/2e1220b4b1bebcbf4ac438c7307bc572124383c4))





## [0.1.38](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.37...v0.1.38) (2026-03-22)


### Features

* **auth:** add Authentik PKCE social login flow ([3f877bd](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/3f877bdf6826fc7e0cae814fce23d793a9d6cd54))





## [0.1.38](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.37...v0.1.38) (2026-03-22)


### Features

* **auth:** add Authentik PKCE social login flow ([3f877bd](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/3f877bdf6826fc7e0cae814fce23d793a9d6cd54))





## [0.1.37](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.36...v0.1.37) (2026-03-22)


### Features

* **cli:** prepare first public npm release ([c013c75](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/c013c75075cea9e93e42926d81f3a4798c409053))
* **iac:** provision auth.cig.technology Authentik SSO on AWS ([0b750ed](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/0b750ed148e706f510dc8cdf0b54876302c32e1e))





## [0.1.37](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.36...v0.1.37) (2026-03-22)


### Features

* **cli:** prepare first public npm release ([c013c75](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/c013c75075cea9e93e42926d81f3a4798c409053))
* **iac:** provision auth.cig.technology Authentik SSO on AWS ([0b750ed](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/0b750ed148e706f510dc8cdf0b54876302c32e1e))





## [0.1.36](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.35...v0.1.36) (2026-03-21)





## [0.1.36](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.35...v0.1.36) (2026-03-21)





## [0.1.35](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.34...v0.1.35) (2026-03-21)





## [0.1.35](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.34...v0.1.35) (2026-03-21)





## [0.1.34](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.33...v0.1.34) (2026-03-21)





## [0.1.34](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.33...v0.1.34) (2026-03-21)





## [0.1.34](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.33...v0.1.34) (2026-03-21)





## [0.1.34](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.33...v0.1.34) (2026-03-21)





## [0.1.33](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.32...v0.1.33) (2026-03-21)


### Bug Fixes

* **docs:** remove duplicate changelog entries; sync all workspace package versions to 0.1.33



## [0.1.32](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.31...v0.1.32) (2026-03-21)

### Bug Fixes

* **docker:** add packages/i18n to dashboard Dockerfile build context ([8a2645c](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/8a2645cc33dbe32857e8e3ed86571b5553a9170c))


## [0.1.31](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.30...v0.1.31) (2026-03-21)

### Features

* **dashboard:** collapsible sidebar sections (Platform, Operations, Account) with smooth CSS grid animation ([f55db3f](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/f55db3fa))
* **dashboard:** new Operations section grouping Device Approval, Targets, and Bootstrap nav items ([f55db3f](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/f55db3fa))
* **dashboard:** integrate @cig-technology/i18n with full EN/ES/ZH internationalization ([f55db3f](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/f55db3fa))
* **dashboard:** add LocaleSwitcher component with globe icon and dropdown ([f55db3f](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/f55db3fa))
* **i18n:** expand dashboard catalog to ~200 keys across sidebar, nav, header, pages, and footer namespaces ([f55db3f](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/f55db3fa))

### Bug Fixes

* **dashboard:** replace Resources icon (cube-transparent) and Graph icon (share/nodes) with better representations ([f55db3f](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/f55db3fa))

## [0.1.30](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.29+build.8...v0.1.30) (2026-03-21)

### Bug Fixes

* **ci:** sanitize Docker tag by replacing '+' with '-' in release tags ([bd246f3](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/bd246f3cd3b6559972f79f844fb2117753e23c38))
* **landing:** defer pointer capture until drag threshold crossed ([bd81fb8](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/bd81fb8b51bee9e571a11a18d20e36530db239be))

### Features

* **dashboard:** redesign UI with CIG dark theme, add Targets & Bootstrap pages ([4aeaa0f](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/4aeaa0f840dd059745d8947d281a1c3f75ad0483)), closes [#050b14](https://github.com/edwardcalderon/ComputeIntelligenceGraph/issues/050b14)
* **landing:** simplify HoloCard to click-opens-modal, hover reveals content ([4eb9a4a](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/4eb9a4a8682e5e52a436eb9f035d01390738c12e))

## [0.1.29](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.28...v0.1.29) (2026-03-21)

### Bug Fixes

* **landing:** only scale card on selection, not on hover ([0ef70d1](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/0ef70d1afa7282fb54f2e2bd4cd0789d4a3d7653))

## [0.1.28](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.27...v0.1.28) (2026-03-21)

### Bug Fixes

* **dashboard:** server-side auth guard + card height expansion ([63f4672](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/63f4672eccad85abfd4f60ade9c47db941e95b2d))

## [0.1.27](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.26...v0.1.27) (2026-03-21)

### Bug Fixes

* **dashboard:** redirect unauthenticated users to landing sign-in ([4e66e7f](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/4e66e7fb83f38a93bde02f7a1934a3e06874be0b))
* **infra:** add apps/dashboard/public dir so Dockerfile COPY doesn't fail ([1dc12c5](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/1dc12c547e88ccfad8513a6a407413e862b8e7d3))
* **infra:** use --ignore-not-found for optional public/ COPY in Dockerfile ([2cb2ea6](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/2cb2ea69bbf0653d9ff762047964cc677ec2a03e))

### Features

* **landing:** add 'Know more' CTA and feature detail modal to HoloCards ([1a33b8b](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/1a33b8b23b70af5d666c732b8b4ad86d1833f901))

## [0.1.26](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.25...v0.1.26) (2026-03-21)

### Features

* **infra:** add GCP Cloud Run provider + Workload Identity Federation ([910f60f](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/910f60fc4ba09ea9bf24a9b13ad74b1ed2e87a9a))

## [0.1.25](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.24...v0.1.25) (2026-03-21)

### Features

* **infra:** add Cloud Run CI/CD pipeline for app.cig.lat dashboard ([3106fa0](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/3106fa0b17ced44f6232882c4ceb4289db4ef9ae))

## [0.1.24](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.23...v0.1.24) (2026-03-21)

## [0.1.23](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.22...v0.1.23) (2026-03-21)

### Bug Fixes

* **dashboard/graph:** resolve infinite re-render loop + react-doctor improvements ([63d9510](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/63d951074cf0b72f0404185df4c5324f8ac3ebdc))

### Features

* **auth:** proper logout flow with shared SignedOut page ([9c1530a](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/9c1530a08efa6b26b3b2bb267d5c67f62296b09d))
* **dashboard:** integrate Refine framework with profile, settings, notifications, and logout ([db78ed3](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/db78ed33515d68c3e4f9022b04ffdf79eaab2dce))

## [0.1.22](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.21...v0.1.22) (2026-03-21)

### Features

* **landing:** add DitheringShader WebGL effect to footer background ([d0d5ad6](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/d0d5ad6c64a238032a309b2893708ebde785666e))

## [0.1.21](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.20...v0.1.21) (2026-03-21)

### Bug Fixes

* **landing:** move FallingPattern from public landing to authenticated landing ([64e6d36](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/64e6d3682b3a47881e5f11d705a126f42a83edd8))

## [0.1.20](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.19...v0.1.20) (2026-03-21)

### Bug Fixes

* **landing:** FallingPattern light mode only, blob glows both modes ([a98d402](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/a98d402621fdea52f9030520ec5e49e906c20b7d))

## [0.1.19](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.18...v0.1.19) (2026-03-21)

### Features

* **landing:** add FallingPattern light-mode background animation ([47eede3](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/47eede34d900535e05e26d91f1d10f9362403fd3))

## [0.1.18](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.17...v0.1.18) (2026-03-21)

### Features

* **i18n:** integrate @cig-technology/i18n into landing app ([67e2659](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/67e2659d02eae91f30009ebe2e86401425f54585))

## [0.1.17](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.16...v0.1.17) (2026-03-21)

### Bug Fixes

* improve landing card contrast and infra path handling ([565f335](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/565f33535e1e2bfc65082990824cef406c85dc57))

## [0.1.16](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.15...v0.1.16) (2026-03-21)

### Bug Fixes

* **ci:** remove explicit pnpm version to avoid conflict with packageManager ([c8d1c0c](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/c8d1c0c9e73647dea67277a03d53bb32befa6fa3))
* **i18n:** correct repository URL for npm provenance verification ([2704b3e](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/2704b3e328ba364e593a13ccaf1f6a96ef7cd1e4))

### Features

* **i18n:** add @cig-technology/i18n v1.0.0 standalone i18n package ([c4b980a](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/c4b980ad9a66a7f5fe1e3b4be00b5d4d198c2123))
* **landing:** add full light/dark mode support with ThemeToggle ([805089e](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/805089ecba62d6a5b2488f5706326d50c69553aa))

## [0.1.15](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.14...v0.1.15) (2026-03-20)

### Bug Fixes

* **auth:** always pass explicit redirectUri in OAuth handlers ([1129e2d](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/1129e2dd20d36bdc8cdf7c8920cbf755c89202ab))

## [0.1.14](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.13...v0.1.14) (2026-03-20)

### Bug Fixes

* **landing:** wire Google/GitHub OAuth in SignInButtonOnly ([4b411d5](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/4b411d56031f6aa3a3e0482fab37d81abd1daf8f))

## [0.1.13](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.12...v0.1.13) (2026-03-20)

### Bug Fixes

* **landing:** always show sign-in button even without Supabase client ([f78235a](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/f78235ace651bf6c49ee6831f426d6bff73feb19))

## [0.1.12](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.11...v0.1.12) (2026-03-20)

### Bug Fixes

* **auth:** add useAuthAvailable to fully guard useAuth() calls ([8cef38f](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/8cef38f0fa92a218d3855ae1aeb5b67a33a87c2b))

## [0.1.11](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.10...v0.1.11) (2026-03-20)

### Bug Fixes

* **auth:** fix useAuth called outside AuthProvider on missing Supabase env vars ([6026724](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/6026724ab1c0c29c0f6546d220dfeb27bbfd2b79))

## [0.1.10](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.9...v0.1.10) (2026-03-20)

### Bug Fixes

* **landing:** fix black screen on cig.lat, add concurrently colors ([0006cb1](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/0006cb17f506a11d538c2376d767aa1e835b45e5))

## [0.1.9](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.8...v0.1.9) (2026-03-20)

### Bug Fixes

* **deps:** add @cig/ui workspace dep to dashboard and wizard-ui; add tailwindcss to wizard-ui ([b8dc105](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/b8dc10531a5b6b0b8a2652825bcbf3d72e63a4a9))
* **landing:** add @cig/ui dep, add build gate to release script ([5d68889](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/5d68889a6b26b7855a67193ee4d4dd76f1a0edb7))

## [0.1.8](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.7...v0.1.8) (2026-03-20)

### Bug Fixes

* **landing:** show authenticated landing for logged-in users, fix build errors ([43089c4](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/43089c4f3b9c07dfab0d5fc3c0baadbcd2adde6d))

## [0.1.7](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.6...v0.1.7) (2026-03-19)

### Features

* **newsletter:** add email subscription with Supabase persistence ([3c06872](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/3c06872922a98e1935e4493873f2ab3c92c3909f))
* **ui:** add @cig/ui design system with glass morphism theme ([f67a887](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/f67a887348c9fcc35d279c7b4430df1bad88c123))

## [0.1.6](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.5...v0.1.6) (2026-03-19)

## [0.1.5](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.4...v0.1.5) (2026-03-19)

## [0.1.4](https://github.com/edwardcalderon/ComputeIntelligenceGraph/compare/v0.1.3+build.2...v0.1.4) (2026-03-19)
## 0.1.3 (2026-03-19)

### Bug Fixes

* **landing:** add basePath/assetPrefix for GitHub Pages subpath deployment ([7a03216](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/7a03216b5dfd3c1e60b6754903ed7c4b6e51c5eb))
* resolve lint failures across all workspace packages ([cff4945](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/cff49457b02415d9e10c9b1e0520bb2dfc8105e3))
* resolve remaining type errors in chatbot and api packages ([2cfb206](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/2cfb2062f67400bce997ab0c89b7a99c8d443d7c))
* **sdk:** pass with no tests until sdk is implemented ([89a6915](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/89a691545b725ce1a53e96aacd95c59b50e797b4))
* set cig.lat as primary domain and keep legacy fallback ([621aa54](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/621aa54e3172664bc9620838123393078ea878b3))
* update pnpm version to 9 in deploy-landing workflow ([3c064ba](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/3c064baaf0a780f477770082f5a9719e27294159))

### Features

* **auth:** add @cig/auth package with Supabase OAuth + multi-method sign-in modal ([598d8e6](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/598d8e6a908a8d143a5ad25fe92a41e05b1b178b))
* display app version from root package.json in all app footers ([53c6dd6](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/53c6dd6f3d18e23b34642b2dbc5b817129b3c90d))
* **infra:** add @cig/infra deployment wrapper package v0.1.2 ([8a65090](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/8a65090914f59e95f3ee2bde964aa662eb9fe888))
* **landing:** add CIG favicon, manifest PNGs, inline SVG icon, fix themeColor viewport ([9b8741b](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/9b8741ba5db1cdaa081ba194798a6834f70b66e6))
* **landing:** add cursor-driven graph-particle 'CIG' typography to hero section ([50a7beb](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/50a7beb9d7d82a1352d7a409952c2c8dbfea030b))
* **landing:** add space particle animation behind CIG text, enlarge canvas ([b5a11bd](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/b5a11bdec14e6b353f594bec03a5cf40670fd5f9))
* **landing:** animated hero icon+title sequence (Compute→Intelligence→Graph→CIG) ([2876ad8](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/2876ad85cffb2d994cd455c856979bc90e0be602))
* **landing:** loop hero icon+title animation infinitely ([008f94e](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/008f94e7e34f6d5257a8f97a307ddc2746d07dee))
* **landing:** upgrade landing page with scroll animations, back-to-top, and release script ([2e3cd9d](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/2e3cd9d25952e3403fa8c1d4255f89011f67b945))
* upgrade to @edcalderon/versioning v1.4.7 with workspace-scripts ([b6a8bdf](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/b6a8bdfc0e176234791ee5645987238139a57b43))

## [0.1.2] - 2026-03-18

### Features

* **infra:** add `@cig/infra` deployment wrapper package — ConfigManager, Logger, InfraWrapper, IACIntegration, AuthentikDeployer, DashboardDeployer, CLI entry point, full error hierarchy, 37+ tests ([8a65090](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/8a65090914f59e95f3ee2bde964aa662eb9fe888))
* **auth:** add `@cig/auth` package with Supabase OAuth + multi-method sign-in modal ([598d8e6](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/598d8e6a908a8d143a5ad25fe92a41e05b1b178b))
* display app version from root package.json in all app footers ([53c6dd6](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/53c6dd6f3d18e23b34642b2dbc5b817129b3c90d))
* upgrade to @edcalderon/versioning v1.4.7 with workspace-scripts ([b6a8bdf](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/b6a8bdfc0e176234791ee5645987238139a57b43))
* **landing:** animated hero sequence, space particles, cursor-driven graph typography, scroll animations ([2e3cd9d](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/2e3cd9d25952e3403fa8c1d4255f89011f67b945))
* **landing:** add CIG favicon, manifest PNGs, inline SVG icon ([9b8741b](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/9b8741ba5db1cdaa081ba194798a6834f70b66e6))

### Bug Fixes

* resolve lint failures across all workspace packages ([cff4945](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/cff49457b02415d9e10c9b1e0520bb2dfc8105e3))
* resolve remaining type errors in chatbot and api packages ([2cfb206](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/2cfb2062f67400bce997ab0c89b7a99c8d443d7c))
* **landing:** add basePath/assetPrefix for GitHub Pages subpath deployment ([7a03216](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/7a03216b5dfd3c1e60b6754903ed7c4b6e51c5eb))
* set cig.lat as primary domain and keep legacy fallback ([621aa54](https://github.com/edwardcalderon/ComputeIntelligenceGraph/commit/621aa54e3172664bc9620838123393078ea878b3))

## [0.1.1] - 2026-03-16

### Features

* initial monorepo setup with pnpm + TurboRepo
* Neo4j graph engine with traversal, circular dependency detection, 61 unit tests
* Fastify API with REST, GraphQL, WebSocket, auth, rate limiting, 108 tests
* Next.js 14 dashboard with resource views, graph visualization, costs, security, 37+ E2E tests
* Python Cartography discovery service + TypeScript orchestrator
