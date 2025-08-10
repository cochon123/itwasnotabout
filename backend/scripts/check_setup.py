#!/usr/bin/env python3
"""
Vérifie l’existence des chemins clés, assets, et variables d’environnement requises.
"""
import os
from dotenv import load_dotenv


def main():
    root = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
    checks = []
    checks.append(("assets/video", os.path.join(root, 'assets', 'video')))
    checks.append(("assets/audio", os.path.join(root, 'assets', 'audio')))
    checks.append(("assets/fonts/impact.ttf", os.path.join(root, 'assets', 'fonts', 'impact.ttf')))
    checks.append(("backend/data/sample.md", os.path.join(root, 'backend', 'data', 'sample.md')))
    checks.append(("backend/data/video_list.txt", os.path.join(root, 'backend', 'data', 'video_list.txt')))
    checks.append(("output/audio", os.path.join(root, 'output', 'audio')))
    checks.append(("output/video", os.path.join(root, 'output', 'video')))

    print("=== Vérification des chemins ===")
    for name, path in checks:
        exists = os.path.exists(path)
        print(f"{name:28} -> {'OK' if exists else 'MANQUANT'} : {path}")

    load_dotenv()
    print("\n=== Variables d'environnement ===")
    for k in ["GOOGLE_API_KEY", "GEMINI_API_KEY", "OPENAI_API_KEY"]:
        print(f"{k:16}: {'SET' if os.getenv(k) else 'ABSENT'}")

    print("\nAstuce: copiez .env.example en .env et remplissez les clés.")


if __name__ == '__main__':
    main()
