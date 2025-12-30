import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("Error: GOOGLE_API_KEY not found in .env")
    exit(1)

genai.configure(api_key=api_key)

with open("models_output.txt", "w", encoding="utf-8") as f:
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"- {m.name}")
                f.write(f"- {m.name}\n")
    except Exception as e:
        print(f"Error listing models: {e}")
        f.write(f"Error listing models: {e}\n")
