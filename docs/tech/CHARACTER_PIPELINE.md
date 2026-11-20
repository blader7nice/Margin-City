# Pipeline postaci 3D — Margin City (stan: Milestone 02)

## Co już działa (zweryfikowane w buildzie)

- **Blender → glTF 2.0 (GLB) → three.js.** Skrypt `game/tools/blender/make_leon.py` buduje w Blenderze 5.3 oryginalny,
  stylizowany model testowy Leona: jedna siatka (~10 tys. trójkątów, 10 materiałów), szkielet z 17 kośćmi,
  wagi skinningu i **12 klipów animacji** szkieletowej. Eksport GLB, potem `gltf-transform optimize` (meshopt + kwantyzacja):
  **435 KB → 185 KB**.
- **Kontrakt klipów** (nazwy, których oczekuje gra):
  `Idle, Walk, Run, CrouchIdle, CrouchWalk, Push, JumpUp, Fall, Slide, Mantle, Hide, Caught`.
  Każdy model Leona, który dostarczy te klipy (od artysty, z Mixamo, z AI-bazy po obróbce), wchodzi do gry bez zmian w kodzie.
- **Maszyna stanów animacji** (`game/src/render/gltfCharacter.ts`): klipy wybiera wyłącznie stan symulacji.
  Przenikania 0,08–0,18 s, tempo cyklu skaluje się z prędkością. Na szkielet nakładane są dodatkowo:
  obrót głowy w stronę MM-01 i proceduralny szalik zaczepiony o kość szyi.
- Przełącznik w grze: **G** (model GLB ↔ rig proceduralny), parametr URL `leon=procedural`.

Komendy:

```bash
cd game
npm run model:leon
```

Polecenie wymaga Pythona z modułem `bpy` (`pip install bpy==5.3.0`) albo zainstalowanego Blendera
(`blender -b -P tools/blender/make_leon.py -- out.glb`).

## Rekomendacja: najtańsza droga do docelowych modeli Leona i MM-01

Zasada: **nie płacimy za finalne assety, dopóki nie przejdzie etap B.**

| Etap | Co | Koszt (szacunek) | Wynik / kryterium przejścia |
|---|---|---|---|
| A — zrobione | Pipeline + kontrakt klipów + model testowy | 0 zł | Model z animacjami działa w przeglądarce |
| B — blockout z concept artów | Bazowa siatka Leona i MM-01 z zatwierdzonych concept artów: ręcznie w Blenderze albo z narzędzia image-to-3D na **płatnym planie komercyjnym** (1 miesiąc). Potem retopologia i czyszczenie w Blenderze, auto-rig (Mixamo / AccuRIG), animacje ruchu z Mixamo, a stealth (kucanie, ukrycie, wspinaczka, pchanie) dokręcone w Blenderze | ~0–150 zł | Playtest 5 osób: sylwetki czytelne z kamery gry, brak artefaktów skinningu, ≤20 tys. trójkątów na postać |
| C — dopracowanie przez profesjonalistę | Zlecenie tylko tam, gdzie AI i blockout przegrywają: **twarz MM-01** (zbliżenia w przerywnikach) i finalne tekstury obu postaci | ~1,5–6 tys. zł za 2 postacie; zebrać 3 oferty | Pełne prawa komercyjne, pliki źródłowe, szkielet zgodny z Mixamo, GLB z naszymi nazwami klipów |

Koszty w tabeli to **moje szacunki**, a nie wyceny. Przed decyzją trzeba je potwierdzić ofertami.

## Licencje — do sprawdzenia przed użyciem (nie zakładać)

- **Blender**: darmowy (GPL). Prawa do modeli, które w nim zrobimy, należą do nas.
- **Mixamo (Adobe)**: darmowy z kontem Adobe. Według mojej wiedzy postacie i animacje wolno używać w komercyjnej grze,
  ale nie wolno redystrybuować surowych plików. **Zweryfikować aktualne FAQ i warunki.**
- **AccuRIG (Reallusion)**: darmowe narzędzie do auto-rigu. **Sprawdzić licencję eksportu.**
- **Generatory image-to-3D** (np. Meshy, Tripo, Rodin): prawa komercyjne zwykle tylko na planach płatnych, a darmowe plany
  mają ograniczenia. Jakość dobra do rekwizytów i baz, słabsza przy czystej topologii i twarzach. **Sprawdzić regulamin planu w dniu zakupu.**
- **Otwarte modele z ograniczeniem terytorialnym**: niektóre licencje wykluczają UE. **Nie używać, dopóki nie potwierdzimy,**
  że Polska jest objęta licencją.
- Zasada projektu: concept arty to referencje. Nie kopiujemy postaci z innych gier, a każdy asset ma udokumentowane źródło i licencję.

## Czego potrzebuję od właściciela

1. **Zatwierdzone concept arty Leona i MM-01** (pliki), żeby zrobić blockout zgodny z kanonem. W repozytorium ich nie ma.
2. Decyzja: etap B ręcznie w Blenderze (wolniej, 0 zł) czy z jednomiesięcznym planem image-to-3D (szybciej, ~100 zł).
