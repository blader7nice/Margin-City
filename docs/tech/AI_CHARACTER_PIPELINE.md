# AI Character Pipeline — wyniki testów M04 i rekomendacja

Stan na 23.11.2026. Ceny zebrane z wyszukiwarki i agregatorów (źródła na dole). **Przed zakupem trzeba je potwierdzić na stronie producenta**, bo źródła bywają sprzeczne.

## Wniosek w trzech zdaniach

1. Jakości concept artów nie osiągniemy skryptowym modelowaniem. Potrzebna jest baza z narzędzia image-to-3D, a w razie potrzeby poprawki artysty w twarzy.
2. Najlepszy stosunek jakości do ceny i prywatności ma **Tripo Pro** (ok. $20 za miesiąc). Prywatne modele, licencja komercyjna, dane płatnych użytkowników nie trafiają do trenowania (wg centrum pomocy Tripo), siatka quad pod rigging. 3000 kredytów wystarczy na wszystkie 4 postacie z wariantami.
3. Cały proces po naszej stronie (orientacja, skala, nasz szkielet, wagi, 13 animacji, GLB, gra) **już działa i jest przetestowany**. Wynik z AI trafia do gry w kilka minut, a nie dni.

## Porównanie narzędzi

| | Tripo (Pro) | Meshy (Pro) | Rodin / Hyper3D (Creator) | Mixamo | AccuRIG | Lokalnie: TRELLIS / Hunyuan3D |
|---|---|---|---|---|---|---|
| Rola | image→3D + auto-rig | image→3D + rig + 500+ animacji | image→3D (detal) | auto-rig + animacje | auto-rig (desktop) | image→3D |
| Cena | ~$20 / mies., 3000 kr. (~15–25 kr. za model) | ~$20 / mies., 1000 kr. (~20–35 kr. za model) | ~$30 / mies. (lub $24 rocznie) | za darmo (konto Adobe) | za darmo (konto ActorCore) | za darmo, ale wymaga GPU |
| Licencja komercyjna | tak (płatne plany); darmowy: modele publiczne, niekomercyjne | tak (płatne); darmowy: CC BY 4.0 | sprzeczne źródła — wprost tylko plan Business | royalty-free (FAQ Adobe) | rig: tak; animacje ActorCore ograniczone | TRELLIS: MIT (zależności do sprawdzenia); **Hunyuan3D 2.0: licencja wyklucza UE** |
| Prywatność wysyłanych obrazów | płatni: wejścia i wyniki nie są używane do trenowania (pomoc Tripo, Terms 5.2.2) | **niejasne** — nie znalazłem jednoznacznej deklaracji dla planów nie-enterprise | do sprawdzenia | wysyła się model, nie concept | lokalnie | lokalnie |
| Rig i animacje | auto-rig w studiu | auto-rig + biblioteka ruchów za darmo w aplikacji | brak (T-pose do riggingu) | tak (tylko humanoidy) | tak | brak |
| Eksport | GLB/FBX/OBJ | GLB/FBX/OBJ/USDZ | GLB/FBX/OBJ | FBX | FBX | GLB/OBJ |
| W tym kontenerze | — | — | — | — | — | **niemożliwe**: brak GPU, sieć blokuje huggingface.co |

Testy porównawcze z 2026 (głównie od producentów lub afiliantów, więc z dystansem): Tripo jest najczęściej wskazywany do postaci pod gry (topologia quad pod rig), Rodin do detalu, Meshy do szybkich iteracji. **Jednoznacznego zwycięzcy dla stylizowanych twarzy nie ma** — dlatego proponuję test na naszym concepcie, a nie wiarę w rankingi.

## Co przetestowałem bez płatnych usług

- **Lokalne modele open-source:** w tym środowisku nie da się ich uruchomić. Nie ma GPU (TRELLIS go wymaga), a polityka sieci blokuje huggingface.co, skąd pobiera się wagi. Hunyuan3D i tak odpada licencyjnie (UE).
- **Pipeline dopasowania („conform”)**, w całości lokalny: `tools/blender/conform_character.py`.
  1. Import GLB/OBJ/FBX, usunięcie obcych rigów, scalenie siatek.
  2. Orientacja: oś lewo-prawo z PCA klatki piersiowej, przód z kierunku palców stóp. Do tego skala do zadanego wzrostu, stopy na ziemi, budżet trójkątów.
  3. Punkty orientacyjne (dłonie, barki, biodra), na ich podstawie **nasz szkielet** o wspólnych nazwach kości.
  4. Wagi metodą „bone heat” z Blendera; gdy zawiedzie, automatycznie wagi regionowe z `charlib`.
  5. Klipy z `tools/blender/clips.py` (kontrakt Leona: 13 klipów; MM-01: 5), eksport GLB.
- **Test na modelu zastępczym**, który udaje wynik AI (`tools/blender/make_ai_standin.py --fused`): Leon v2 przerobiony na jedną zamkniętą powierzchnię (remesh wokselowy) z jedną wypaloną teksturą, o innej skali i obrocie.
  - **Wynik:** orientacja (−89°) i skala (×2,64) wykryte poprawnie, nasz szkielet i 13 klipów działają w grze (chód, kucanie; zrzuty w `docs/prototype/screens/m04/`). Całość trwa ok. 15 s.
  - **Ograniczenie:** „bone heat” na sztucznie scalonym modelu bywa niestabilny i wtedy działa zapas (wagi regionowe), z widocznym gorszym zginaniem torby i poł kurtki. Prawdziwe wyniki z Tripo i Meshy są czystsze; jeśli i tam wagi zawiodą, zostaje rig z samego Tripo albo Mixamo.
- **Podgląd A/B w grze:** `?leonModel=models/test/<plik>.glb`.

## Propozycja testu Leona — wymaga Twojej zgody

**Koszt:** 1 miesiąc Tripo Pro, ok. $20 (z VAT ok. 95–100 zł przy kursie ~4 zł/$; do potwierdzenia przy zakupie). Odnowienie wyłączyć od razu.

**Wymaga zgody na:**
1. zakup;
2. wysłanie wycinka concept artu Leona do Tripo — na planie płatnym modele są prywatne, a wejścia nie trafiają do trenowania (wg Tripo).

**Kroki:**
1. Wycinam Leona z lineupu (`docs/design/reference/character_lineup_concept.png`): jedna postać, neutralne tło.
2. Tripo: image→3D, 3–5 wariantów, tekstury, opcja quad i A-pose. Kosztuje ok. 100–200 z 3000 kredytów.
3. Pobranie GLB. Ty wrzucasz pliki do repo (`game/tools/blender/in/`), albo dajesz mi klucz API przez bezpieczny formularz środowiska (wtedy wywołuję API sam; klucz nie trafia do czatu ani repo).
4. Ja: `conform_character.py --clips leon --height 1.78`, kompresja tekstur (WebP/KTX2), podgląd w grze obok Leona v2.
5. Zrzuty z dystansu i z bliska; klipy idle, walk, run, jump, crouch, climb (mantle), push; ocena deformacji kurtki, ramion, nóg i twarzy.

**Kryteria decyzji** (ocena Twoja i 2–3 osób):

| Wynik | Warunek | Decyzja |
|---|---|---|
| **Rozwijamy** | twarz i sylwetka wyraźnie bliżej conceptu niż v2; skinning bez rażących artefaktów po mojej obróbce; ≤ 50 tys. trójkątów; ≤ 1 dzień pracy | w tym samym miesiącu (bez dodatkowych kosztów) robimy Dave'a, Kate i MM-01 |
| **Zmieniamy** | ciało dobre, twarz słaba | twarz i dłonie zlecamy freelancerowi (szacunek 1,5–3 tys. zł, 3 oferty) albo próbujemy Rodin |
| **Odpuszczamy** | geometria lub tekstury nie do uratowania | pełne zlecenie artyście; pipeline zostaje |

## Animacje: darmowy krok, który można zrobić od razu

Mixamo (konto Adobe, za darmo, royalty-free wg FAQ Adobe) pozwala pobrać animacje na domyślnej postaci „Y Bot”, **bez wysyłania naszych modeli**. Ja przenoszę je na nasz szkielet w Blenderze. To poprawi chód i bieg wszystkich postaci niezależnie od decyzji o AI.

**Wymaga:** konta Adobe i pobrania przez Ciebie wskazanych plików FBX (lista ruchów w osobnej wiadomości po decyzji).

## Źródła

- [Tripo — porównanie planów (affmaven)](https://affmaven.com/tripo-pricing/)
- [Tripo — licencja komercyjna](https://tripo3ds.com/license/)
- [Tripo — pomoc: komercyjne użycie i dane](https://www.tripo3d.ai/help/privacy-policy/can-i-use-models-commercially)
- [Meshy — cennik i kredyty (docs)](https://docs.meshy.ai/en/api/pricing)
- [Meshy — cennik 2026 (renderahouse)](https://www.renderahouse.com/blog/meshy-pricing)
- [Meshy — polityka prywatności](https://meshy.ai/privacy-policy)
- [Hyper3D Rodin — cennik](https://hyper3d.ai/pricing)
- [Mixamo FAQ (Adobe)](https://helpx.adobe.com/en/creative-cloud/faq/mixamo-faq.html)
- [AccuRIG 2.0 (CG Channel)](https://www.cgchannel.com/2025/07/rig-and-animate-3d-characters-for-free-with-accurig-2-0/)
- [Hunyuan3D-2 LICENSE](https://huggingface.co/tencent/Hunyuan3D-2/blob/main/LICENSE)
- [TRELLIS (GitHub)](https://github.com/microsoft/TRELLIS)
- [Porównanie Rodin / Tripo / Hunyuan (3D AI Studio)](https://www.3daistudio.com/blog/rodin-2-5-vs-tripo-vs-hunyuan-3d-comparison)
