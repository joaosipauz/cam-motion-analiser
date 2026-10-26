# Benchmarks — i7-8700 + Intel UHD 630, 32 GB (Windows nativo, 2026-10-26)

Vídeo: câmera Intelbras (loja), 267 s, recomprimido pelo WhatsApp (832x464 H.264 30 fps).
Cópia de teste "realista": mesmo vídeo em 1080p H.265 15 fps, keyframe a cada 2 s.

## Varredura de movimento (`motion_scan.py`)

| Vídeo | Modo | Decode | Velocidade | 12 h levariam |
|---|---|---|---|---|
| 832x464 H.264 | keyframes | CPU | 235x | 3,1 min |
| 832x464 H.264 | todos @5fps | CPU | 120x | 6,0 min |
| 1080p H.265 | keyframes | CPU | 69x | 10,5 min |
| 1080p H.265 | todos @5fps | CPU | 31x | 23,5 min |
| **1080p H.265** | **keyframes** | **dxva2 (iGPU)** | **356x** | **2,0 min** |

Notas:
- Decodificar só keyframes na CPU é ineficiente (~28 keyframes/s, sem paralelismo de frames); na iGPU chega a ~139/s.
- QSV via PyAV não abriu o stream; dxva2 foi o melhor no Windows. No Linux/Docker o equivalente é VAAPI (`/dev/dri`).
- Câmera de loja com movimento quase contínuo: 97% do tempo marcado como movimento. O relógio impresso na imagem precisa ser mascarado automaticamente.

## Melhoria de recorte (`upscale_crop.py`, 4x)

| Recorte | Fiel (15 quadros) | IA iGPU | IA CPU |
|---|---|---|---|
| Pessoas 117x130 | 104 ms | 65 ms | 128 ms |
| Relógio 158x28 | 33 ms | 20 ms | — |

- Compilar o modelo na iGPU leva ~4 s na primeira chamada; usar o cache do OpenVINO (`CACHE_DIR`).
- Trecho de 10 s @15 fps num recorte desse tamanho: ~10–20 s com IA.
- Modo fiel com alinhamento global gera "fantasma" em pessoas em movimento; precisa de alinhamento local (fluxo óptico) e mediana robusta.
- Modelo IA: `realesr-general-x4v3` (Real-ESRGAN compacto, BSD-3), convertido com `convert_model.py`.

## Comparação de modelos (`enhance_compare.py`, recorte 148x138 do vídeo do WhatsApp)

| Modelo | Qualidade | OpenVINO iGPU | OpenVINO CPU |
|---|---|---|---|
| realesr-general-x4v3 | suave, pouco ganho | 0,07 s | 0,13 s |
| **RealESRGAN x4plus** | melhor equilíbrio | **1,3 s** | 2,4 s |
| SwinIR-M real GAN | parecido com x4plus, mais limpo | 0,9 s/bloco 64 px | **0,5 s/bloco** |
| BSRGAN | mais nítido, texturas falsas | — | — |
| GFPGAN (rosto) | inventa rosto deformado (rosto de ~20 px) | — | — |

Nenhum recupera um rosto reconhecível nesse vídeo: o limite é a resolução da fonte.
Escolher o quadro mais nítido em ±2 s ajuda pouco, mas não custa nada.
