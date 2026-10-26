"""Converte um modelo de super-resolucao (.pth) para OpenVINO IR usando spandrel.

Uso:
  python bench/convert_model.py ENTRADA.pth SAIDA.xml [--tile 64]

--tile: converte com entrada fixa (necessario para arquiteturas com janelas, ex. SwinIR).
Sem --tile, a entrada fica dinamica e o app ajusta o tamanho por recorte.
PyTorch/spandrel so sao necessarios aqui; em producao a imagem leva apenas o IR.
"""
import argparse

import openvino as ov
import torch
from spandrel import ModelLoader


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--tile", type=int)
    args = ap.parse_args()

    desc = ModelLoader().load_from_file(args.src)
    model = desc.model.eval()
    size = args.tile or 64
    shape = [1, 3, size, size] if args.tile else [1, 3, -1, -1]
    with torch.no_grad():
        ov_model = ov.convert_model(model, example_input=torch.rand(1, 3, size, size),
                                    input=[ov.PartialShape(shape)])
    ov.save_model(ov_model, args.dst, compress_to_fp16=True)
    print(f"{desc.architecture.name} x{desc.scale} -> {args.dst} (entrada {shape})")


if __name__ == "__main__":
    main()
