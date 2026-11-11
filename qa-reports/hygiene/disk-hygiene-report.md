# Disk hygiene report

Audit and cleanup completed November 11, 2026 in `/home/user/workspace`. Removed 579,288 KiB (565.7 MiB) of explicitly enumerated regenerable files and verified duplicate temporary exports; no source files or repository working trees were removed.

## Before and after

Measurements use allocated disk usage (`du`), not apparent file size. The filesystem is shared with active processes and other hygiene lanes, so aggregate changes can differ slightly from the deletion manifest.

| Measurement | Before | After |
|---|---:|---:|
| `df -h .` filesystem size | 20G | 20G |
| `df -h .` used | 13G | 12G |
| `df -h .` available | 7.2G | 7.7G |
| `df -h .` utilization | 64% | 61% |
| `df -k .` used KiB | 12,934,748 | 12,355,700 |
| `df -k .` available KiB | 7,472,308 | 8,051,356 |
| Workspace `du -sk` | 1,544,056 | 1,543,824 |
| `/tmp` `du -sk` | 2,721,312 | 2,142,772 |
| `~/.perplexity/sessions` | 44M | 44M |

The measured filesystem reduction was 579,048 KiB (565.5 MiB). After measurements precede writing this small report.

### Workspace top-level directories

| Directory | Before `du -h` | After `du -h` |
|---|---:|---:|
| SHMT | 1.2G | 1.2G |
| px-replay | 210M | 210M |
| memory | 43M | 43M |
| qa-reports | 40M | 40M |
| ai-gateway-live | 34M | 33M |
| ai-gateway-site | 13M | 13M |
| ai-spaincos-specs | 1.3M | 1.3M |
| eval-run | 312K | 312K |
| _deploy | 292K | 292K |
| ai-gateway | 240K | 240K |
| self-improve | 144K | 144K |
| guardians | 120K | 120K |
| _secrets | 12K | 12K |
| .trash | absent | 4K |
| Total workspace | 1.5G | 1.5G |

## Deleted items

Temporary dependency trees were outside repositories and outside observed active process working directories. `/tmp/node_modules` was deliberately retained because a running Node process referenced it.

| Deleted path | Allocated KiB |
|---|---:|
| `/tmp/ec/node_modules` | 31,280 |
| `/tmp/docs/node_modules` | 27,916 |
| `/tmp/dr-qa/node_modules` | 27,076 |
| `/tmp/w/node_modules` | 23,464 |
| `/tmp/qa/node_modules` | 39,260 |
| `/tmp/tsc2/node_modules` | 42,624 |
| `/tmp/t/node_modules` | 39,260 |
| `/tmp/pjqa/node_modules` | 15,728 |
| `/tmp/esb/node_modules` | 42,624 |
| `/tmp/stgtest/node_modules` | 27,916 |
| `/tmp/stgtest/tscheck/node_modules` | 31,280 |
| `px-replay/__pycache__` | 44 |
| `ai-gateway-live/qa/quality/__pycache__` | 12 |
| `ai-gateway-live/qa/__pycache__` | 144 |
| `ai-gateway-live/sandbox/__pycache__` | 20 |
| `ai-gateway-live/sandbox/tests/__pycache__` | 20 |
| `/tmp/pxhist/conversations-20261109_103038-3340b43f.json` | 115,312 |
| `/tmp/pxexport/conversations-20261109_103038-3340b43f.json` | 115,308 |
| **Total** | **579,288** |

Both deleted conversation exports passed a byte-for-byte `cmp` against the retained `px-replay/conversations-20261109_103038-3340b43f.json` immediately before deletion. The XLSX files in the temporary export directories were retained.

## Retained items and owner decisions

- **Duplicate checkout `/tmp/shmt`, 989M:** retained intact because it is a Git working tree. Compare branches, uncommitted changes, and operational references before any owner-approved removal.
- **Primary `SHMT`, 1.2G:** largest components are `.git` 299M, `client` 291M, `supabase` 265M, `apps` 151M, and `docs` 64M. These are repository content or history, not disposable junk.
- **`/tmp/audit`, 574M:** includes 566M of function `.bin` artifacts. Retained because their provenance and retention needs were not established; owner can decide whether these audit snapshots are still needed.
- **`/tmp/bsvenv`, 176M:** retained pending confirmation that the environment is disposable and reproducible.
- **`px-replay`, 210M:** retained primary conversation export 113M, golden-set JSONL 65M, result JSONLs, and small import logs. These may be active evaluation evidence or import recovery material.
- **`qa-reports`, 40M:** includes `shots-v82` 21M. No files matched the conservative cutoff earlier than November 9, 2026, so no QA material was removed, including its 12K Python cache.
- **`/tmp/node_modules`, 50M:** referenced by a running process; retained.
- **`/tmp/rea_perplexity`, 67M, and `/tmp/.external_execution_events`, 68M:** runtime-associated data retained. Current logs, PID files, and execution-service metadata were not touched.
- **`memory`, 43M, and `~/.perplexity/sessions`, 44M:** retained as session/knowledge assets. The latter was inspected read-only solely for size.
- **`SHMT/dashboard/dist`, 16K:** build-looking folder is tracked (`data.json`, `index.html`), so retained under the repository protection rule.
- **Archives:** retained repository evidence archives of approximately 3.0M, 2.5M, and 878K under `SHMT/research/hap` and `SHMT/roadmap/progress`. Small extension release ZIPs (roughly 10–12K each) were retained as release/session artifacts.

No uncertain assets were moved: leaving them at their original paths avoids breaking active references. `.trash/` was created and remains empty; moving files there would not recover filesystem capacity.

## Verification and boundaries

The shared `px-replay/memory_items.json` remained present at 876K. Its SHA-256 was identical before and after:

```text
7a20e3a8a281f82b3b4b1583b0b8d52c753c1d9f352432537e0162fd0a74c855
```

No repository was deleted, no tracked build files were removed, and no commits or deployments were made. No files under `~/.perplexity/sessions` were changed.
