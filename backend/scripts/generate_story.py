#!/usr/bin/env python3
"""
Génère une nouvelle histoire à partir d'un exemple donné en utilisant Google Gemini.
Modèle par défaut: gemini-2.5-flash
"""
import argparse
import sys
import os
from dotenv import load_dotenv

def generate_story(input_file, output_file, model):
    # Lire l'histoire d'exemple
    with open(input_file, 'r', encoding='utf-8') as f:
        sample = f.read()

    # Préparer le prompt pour l'LLM
    prompt = (
        "Here are several stories:\n" + sample +
        "\n\nPlease generate a new story that is different but follows the same pattern.\n"
        "Just generate the story content only (no title, no summary).\n"
        "Use simple, engaging language. Start similarly to the provided stories.\n"
    )

    # Génération avec retry et metrics
    import time, json
    max_attempts = 3
    for attempt in range(1, max_attempts+1):
        try:
            print(f"=== Début de la génération (essai {attempt}) ===")
            gen_start = time.time()
            # Configurer l'API
            load_dotenv()
            api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise RuntimeError("Veuillez définir GOOGLE_API_KEY ou GEMINI_API_KEY dans l'environnement ou le fichier .env")
            import importlib
            try:
                genai = importlib.import_module("google.generativeai")
            except ImportError:
                raise RuntimeError(
                    "Le package google-generativeai est manquant. Installez-le via 'pip install google-generativeai' ou ajoutez-le à backend/requirements.txt et réinstallez."
                )
            genai.configure(api_key=api_key)

            model_client = genai.GenerativeModel(model)
            response = model_client.generate_content(prompt)
            story = response.text or ""
            gen_duration = time.time() - gen_start
            total_tokens = len(story.split())
            print(story)
            print(f"\n=== Fin génération : {len(story)} caractères en {gen_duration:.1f}s, tokens={total_tokens}, tps={total_tokens/gen_duration if gen_duration>0 else 0:.1f}")
        except Exception as e:
            print(f"Erreur durant génération : {e}")
            if attempt == max_attempts:
                sys.exit(1)
            continue
        # Vérifier longueur minimale
        if len(story) < 200:
            print(f"Génération trop courte ({len(story)} chars), relance...")
            if attempt == max_attempts:
                print("Échec après plusieurs essais")
                sys.exit(1)
            continue
        # Sauvegarder métriques
        meta = {
            'length_chars': len(story),
            'total_tokens': total_tokens,
            'duration_s': round(gen_duration, 2),
            'tokens_per_s': round(total_tokens/gen_duration, 2)
        }
        meta_file = os.path.splitext(output_file)[0] + '_meta.json'
        with open(meta_file, 'w', encoding='utf-8') as mf:
            json.dump(meta, mf, ensure_ascii=False, indent=2)
        break

    # Enregistrer l'histoire générée
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(story)

    print(f"Histoire générée enregistrée dans {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Générer une nouvelle histoire à partir d'un fichier markdown existant"
    )
    parser.add_argument(
        'input_file',
        nargs='?',
        default=os.path.normpath(os.path.join(os.path.dirname(__file__), '../data/sample.md')),
        help='Fichier markdown avec l\'histoire exemple'
    )
    parser.add_argument(
        'output_file',
        nargs='?',
        default=os.path.normpath(os.path.join(os.path.dirname(__file__), '../data/generated_story.md')),
        help='Fichier de sortie pour l\'histoire générée'
    )
    parser.add_argument(
        '--model',
        default='gemini-2.5-flash',
        help='Nom du modèle Google Gemini à utiliser'
    )
    args = parser.parse_args()

    generate_story(args.input_file, args.output_file, args.model)

if __name__ == '__main__':
    main()
