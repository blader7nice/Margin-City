# The Last Shift — prototyp (Three.js) · Milestone 02

Pilot technologiczny MARGIN CITY: THE LAST SIGNAL. Jeden reprezentatywny fragment hali notowań z misji
*The Last Shift*: Leon, MM-01, skradanie, kryjówki, prognoza MIRROR, przerywnik, kamera cinematic 2.5D.
**Nie jest to decyzja o porzuceniu Godota** — prototyp służy do oceny technologii i kierunku artystycznego.

## Co jest w Milestone 02

- **Zagadka „The Archivist's Balance”** (korytarz B-12): sejf zaplombowany → dwie mosiężne klatki na jednym łańcuchu →
  wózek z aktami (240 kg) do lewej klatki → Leon w prawej klatce zwalnia hamulec → zepsuty pomost → panel włazu
  (wyraźnie ostrzega o alarmie). Bez soft-locków (testy).
- **Pościg w skrzydle archiwum B**: dwa poziomy (podłoga + pomost). MIRROR przewiduje trasę i zamyka bramę na
  przewidywanym poziomie (zapowiedź światłem i tekstem). MM-01 jest wolniejszy od biegnącego Leona, ale odcina drogę:
  schody spiralne, korytarz serwisowy, czekanie w miejscu przewidywanego zejścia. Trzecia droga: kanał serwisowy
  (MIRROR traci cel). Ślizg pod zamykającą się bramą, checkpointy na starcie i w połowie, finał przy szklanych drzwiach
  terminala B-12.
- **Pipeline postaci GLB**: Leon z Blendera (skinning, 12 klipów), maszyna stanów animacji, przełącznik **G**.
  Szczegóły: `docs/tech/CHARACTER_PIPELINE.md`.
- **Scena**: pula świateł (stały koszt GPU przy dowolnej liczbie lamp), wygaszanie zasłaniających obiektów,
  adaptacyjne doświetlenie Leona w ciemności, mocniejszy kontur MM-01, łagodniejsze wejście, oświetlony narożnik B-12.

## Uruchomienie

```bash
cd game
npm install
npm run dev        # http://localhost:5173
npm run build      # produkcyjny build → dist/
npm test           # testy symulacji (uczciwość AI, przechodniość poziomu)
npm run textures   # regeneracja tekstur proceduralnych (Python 3 + numpy + Pillow)
npm run model:leon # przebudowa modelu Leona w Blenderze (bpy) + optymalizacja GLB
```

Pomiary (wymaga Playwright/Chromium): `node tools/measure.mjs measurements/report.json`.
Na własnym sprzęcie otwórz build z `?bench=1` — autopilot przejdzie poziom i pokaże raport klatek (do skopiowania).

## Sterowanie

A/D ruch · Shift bieg (głośny) · Spacja skok i wspinaczka na krawędzie · Ctrl/C kucanie · E kryjówka/interakcja ·
S+Spacja zeskok z pomostu / do kanału · Ctrl w biegu: ślizg · T warstwa techniczna · G model Leona · F1 lub ` debug · 1/2/3 jakość. Pad: Gamepad API.

## Parametry URL (testy, zrzuty)

| Parametr | Działanie |
|---|---|
| `q=low|medium|high` | preset jakości |
| `view=tech` | warstwa techniczna (greybox + debug AI) |
| `debug=1` | nakładka debug na warstwie wizualnej |
| `bench=1` | autopilot + raport wydajności |
| `autostart=1`, `nointro=1`, `noreveal=1` | pominięcie ekranu startowego / najazdu / przerywnika |
| `spawn=x,y`, `gx=x&gf=±1`, `god=1` | pozycja Leona / MM-01, wyłączona percepcja MM-01 |
| `chase=1` (lub `#chase`), `solved=1` | start w pościgu / z rozwiązaną zagadką |
| `leon=procedural` | rig proceduralny zamiast modelu GLB |
| `camFollow=dx,dy,dz[,fov]` | kamera foto śledząca Leona |
| `cam=px,py,pz,tx,ty,tz[,fov]`, `freeze=1` | tryb foto |

## Architektura

- `src/sim/` — **czysta symulacja** (bez three.js), stały krok 120 Hz, w pełni testowalna w Node:
  `level.ts` (jedno źródło prawdy: kolizje, osłony, światło, trasy, ujęcia kamery), `leon.ts` (kinematyczny
  kontroler 2.5D: coyote time, bufor skoku, zmienna wysokość skoku, wspinaczka na krawędzie, kucanie, kryjówki),
  `guard.ts` (MM-01: Patrol → Suspicion → Chase → Search → Return, widzenie zależne od światła, linia wzroku,
  słuch, prognoza MIRROR), `world.ts` (checkpointy, przerywnik, złapanie/respawn).
- `src/render/` — warstwa wizualna (`hall.ts`, `characters.ts`, `camera.ts`, `post.ts`) i techniczna (`techView.ts`).
- `src/audio/` — dźwięk proceduralny WebAudio (bez plików).
- `public/tex/` — tekstury generowane przez `tools/gen_textures.py` (oryginalne, bez licencji zewnętrznych).

## Zasady uczciwości MM-01 (pokryte testami)

Widzi tylko w stożku światła oka, w zasięgu zależnym od oświetlenia i postawy, przy czystej linii wzroku.
Po zgubieniu Leona idzie do ostatnio **widzianej/usłyszanej** pozycji. Leon w kryjówce jest niewidoczny, chyba że
MM-01 widział, jak do niej wchodził. Jedyna „dodatkowa wiedza” to hotspot prognozy MIRROR — widoczny także dla gracza.
Biegnący Leon jest zawsze szybszy od MM-01.

## Ograniczenia (stan 0.1)

Postacie są proceduralne (prymitywy + animacja proceduralna) — czytelne z dystansu, **nie** są docelową jakością.
Brak wypalonego oświetlenia (lightmap), brak modeli z Blendera, brak prawdziwego audio. WebGPU nie jest
zaimplementowane (ścieżka bazowa: WebGL 2). FPS mierzony w tym środowisku pochodzi z renderowania programowego (CPU).
