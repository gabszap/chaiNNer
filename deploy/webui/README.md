# Deploy da WebUI do chaiNNer na VPS (Caddy + systemd)

Guia rápido para rodar o backend Python (com GPU/CPU) e servir a WebUI estática em **same-origin** usando seu **Caddy** existente.

## 1. Preparar o repositório e o ambiente Python 3.11

```bash
git clone -b feat/webui <URL_DO_SEU_FORK_OU_REPO> /opt/chainner
cd /opt/chainner

# Python 3.11 é recomendado pelos wheels fixados em chaiNNer_standard (numpy 1.24.4 / scipy 1.9.3)
python3.11 -m venv .venv
```

Se quiser instalar PyTorch com CUDA rapidamente direto pelo terminal (recomendado na VPS):

```bash
# Exemplo para CUDA 12.8 (ou cu126 para GPUs Pascal/GTX 10xx):
/opt/chainner/.venv/bin/pip install torch==2.7.0+cu128 torchvision==0.22.0+cu128 \
  --extra-index-url https://download.pytorch.org/whl/cu128
/opt/chainner/.venv/bin/pip install facexlib==0.3.0 einops==0.6.1 safetensors==0.4.0 \
  spandrel==0.4.1 spandrel_extra_arches==0.2.0
```

## 2. Buildar a WebUI estática (`dist-web/`)

Requer Node.js >= 22.12:

```bash
cd /opt/chainner
npm ci --allow-git=all --no-audit --no-fund
npm run web:build
```

Isso gera `/opt/chainner/dist-web/index.html` e `/opt/chainner/dist-web/assets/`.

## 3. Configurar o diretório sandbox de arquivos

```bash
mkdir -p /data/chainner/{inputs,outputs,models,chains}
```

Coloque seus modelos `.pth` / `.onnx` / `.bin+.param` em `/data/chainner/models/`.
O backend valida todo caminho com `Path.resolve().is_relative_to(web_root)`, impedindo acesso fora de `/data/chainner`.

## 4. Subir o serviço `systemd`

```bash
cp /opt/chainner/deploy/webui/chainner-webui.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now chainner-webui
journalctl -u chainner-webui -f
```

Aguarde aparecer `Done.` nos logs (ou confirme readiness real em `/status` — **não** use `/health` para readiness):

```bash
curl -s http://127.0.0.1:8000/status
# Esperado: {"ready":true,"worker":{"executor":"ready"}}

curl -s http://127.0.0.1:8000/version
# Esperado: {"version":"0.26.1","commit":"...","webMode":true,"packageManageAllowed":false}
```

## 5. Plugar no seu Caddyfile

Copie o bloco de `deploy/webui/Caddyfile.example` para o seu `/etc/caddy/Caddyfile`, ajuste domínio/caminho (e ative `basic_auth` se for expor fora do Tailscale) e recarregue:

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

## 6. Flags de segurança do `--web-mode`

| Flag | Efeito |
|------|--------|
| `--web-mode` | Bloqueia `POST /shutdown`, `POST /packages/install` e `POST /packages/uninstall` (HTTP 403) e desativa CORS wildcard (`*`). |
| `--allow-package-manage` | Reabilita instalação/desinstalação de pacotes pela UI mesmo em `--web-mode`. |
| `--web-root <dir>` | Define a pasta sandbox (também aceita env `CHAINNER_WEB_ROOT`). |
| `--host <ip>` | Interface de bind (padrão `127.0.0.1`). |
| `--cors-origin <url>` | Libera CORS apenas para origens específicas (desnecessário atrás do Caddy same-origin). |

## 7. Como atualizar no futuro

```bash
cd /opt/chainner
git pull
npm run web:build
systemctl restart chainner-webui
```
