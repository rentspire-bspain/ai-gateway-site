#!/usr/bin/env python3
"""v283: Vercel REST API deploy (the CLI lost its env token when the session context
changed; curl through the credential proxy is authenticated). Mirrors what
`vercel deploy --prod` does: upload changed files, create the production deployment.
Run via: pplx credentials run <vercel-handle> -- python3 api-vc-deploy.py
"""
import hashlib, json, os, subprocess, sys

ROOT = "/home/user/workspace/ai-gateway-site"
PROJECT = "boundview"
HANDLE = sys.argv[1] if len(sys.argv) > 1 else None

def sh(cmd):
    """Run curl through the credential wrapper (auth injected by proxy)."""
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    return r.stdout

def api(url, method="GET", body=None, is_json=True):
    cmd = ["curl", "-s", "-m", "300", "-X", method, url]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    # v288: upload as base64 in a JSON body (multipart through the proxy corrupts files)
    b64 = __import__("base64").b64encode(data).decode()
    import urllib.request as _ur
    req = _ur.Request("https://api.vercel.com/v2/files?teamId=team_qpLUu8GANcBKGRNwaQP1J1gl",
        data=json.dumps({"file": b64, "encoding": "base64", "sha1": sha, "size": size}).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + __import__("os").environ.get("VERCEL_TOKEN", "")},
        method="POST")
    with _ur.urlopen(req, timeout=300) as r:
        out = r.read().decode()
    return sha, size, out
    return json.loads(out) if is_json and out.strip().startswith(("{", "[")) else out

def upload_file(path, rel):
    with open(path, "rb") as f:
        data = f.read()
    sha = hashlib.sha1(data).hexdigest()
    size = len(data)
    # multipart upload via curl -F
    cmd = ["curl", "-s", "-m", "300", "-X", "POST",
           "https://api.vercel.com/v2/files",
           "-F", f"file=@{path}"]
    # v288: upload as base64 in a JSON body (multipart through the proxy corrupts files)
    b64 = __import__("base64").b64encode(data).decode()
    import urllib.request as _ur
    req = _ur.Request("https://api.vercel.com/v2/files?teamId=team_qpLUu8GANcBKGRNwaQP1J1gl",
        data=json.dumps({"file": b64, "encoding": "base64", "sha1": sha, "size": size}).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + __import__("os").environ.get("VERCEL_TOKEN", "")},
        method="POST")
    with _ur.urlopen(req, timeout=300) as r:
        out = r.read().decode()
    return sha, size, out
    return sha, size, out

# 1. flatten the current deployment tree
tree = json.load(open("/tmp/vc-files.json"))
remote = {}
def walk(node, prefix=""):
    if node.get("type") == "directory":
        for c in node.get("children", []):
            walk(c, prefix + "/" + node["name"] if prefix else "/" + node["name"])
    else:
        p = (prefix + "/" + node["name"]) if prefix else "/" + node["name"]
        # remote tree nests under /src
        if p.startswith("/src/"):
            remote[p[4:]] = node["uid"]
walk(tree[0])

# 2. local files (skip .vercel, .git, qa-private, node_modules)
SKIP_DIRS = {".git", ".vercel", "node_modules", "qa-private", "__pycache__"}
local = {}
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
    for fn in filenames:
        p = os.path.join(dirpath, fn)
        rel = "/" + os.path.relpath(p, ROOT)
        if rel.startswith("/api-vc-deploy.py") or rel.startswith("/.git"):
            continue
        with open(p, "rb") as f:
            data = f.read()
        local[rel] = {"sha": hashlib.sha1(data).hexdigest(), "size": len(data), "path": p}

print(f"local files: {len(local)}, remote files: {len(remote)}")

# 3. upload changed/new
changed = []
for rel, info in local.items():
    if remote.get(rel) != info["sha"]:
        changed.append(rel)
print(f"changed/new files: {len(changed)}")
for rel in changed:
    info = local[rel]
    out = upload_file(info["path"], rel)
    ok = '"error"' not in out or info["sha"] in out
    print(f"  uploaded {rel} ({info['size']}b): {'ok' if ok else out[:120]}")

# 4. build the deployment file list
files = [{"file": rel, "sha": info["sha"], "size": info["size"]} for rel, info in local.items()]
body = {
    "name": PROJECT,
    "files": files,
    "target": "production",
    "projectSettings": {"framework": None},
}
out = api("https://api.vercel.com/v13/deployments", "POST", body)
if isinstance(out, dict) and out.get("id"):
    print("DEPLOYMENT:", out["id"], out.get("readyState"))
    print("URL:", out.get("url"))
else:
    print("DEPLOY ERROR:", json.dumps(out)[:800])
