# Milestone 03: raport

Gałąź: `claude/wonderful-meitner-zopq4u`.
Commity M03: `331e327`, `01fe3cf`, `79a32e3`, `36f9522` oraz commit z tym raportem.

**Powrót do M02:**
- kod: commit `5c81e62` (M02) / `cdda2bf` (M02 z fallbackiem modeli);
- tag `milestone-02` istnieje tylko lokalnie (push tagów odrzucony przez serwer, HTTP 403);
- w grze klawisz **G** przełącza modele GLB ↔ rigi proceduralne;
- `?leon=procedural&mm=procedural` przy starcie.

## Co dostarczono

1. **Terminal B-12 / Market Replay:** grywalny od końca pościgu do zakończenia rozdziału.
   - Elementy: dziennik Dave'a, zlecenie, odsłanianie świec, ocena procesu, nagranie Dave'a, koniec rozdziału.
   - Opis i zasady: `docs/design/MARKET_REPLAY_B12.md`.
   - Zrzuty: `screens/m03/term_*.jpg`.
2. **Leon v2** zgodny z lineupem (sylwetka, kostium, paleta, kompas, animacja z kompasem):
   - zrzuty `03_*.jpg`, porównanie `compare_leon.jpg`.
3. **MM-01 v1:** półludzka / półcybernetyczna twarz, długi płaszcz z podszewką i kośćmi pół, uprząż z LED-ami, klipy `Idle/Walk/Run/Consult/Grab`:
   - zrzuty `04–06_*.jpg`, porównanie `compare_mm01.jpg`, pościg `07–08*.jpg`.
4. **Narzędzia playtestu pościgu:**
   - telemetria lokalna;
   - raport (kopiuj / pobierz JSON) i oceny 1–5 na karcie końcowej (`term_6_endcard.jpg`);
   - znaczniki złapań w warstwie technicznej;
   - strojenie przez URL (`warn, mmspeed, gap, stepout, respawn, closed`).
5. **Czytelność:**
   - pionowe kadrowanie zagrożenia w pościgu (MM-01 nie ląduje na krawędzi kadru);
   - mocniejszy kontur MM-01 w pościgu;
   - wypełnienie twarzy MM-01 w zbliżeniach.
6. **Dokumentacja:**
   - `docs/design/CHARACTER_STYLE_GUIDE.md`: styl, kontrakt, plan Dave/Kate, opcje i koszty jakości docelowej;
   - `docs/design/MARKET_REPLAY_B12.md`.

Nie zmieniałem: sterowania, skradania, zagadki „Waga archiwisty”, logiki pościgu i prognozy MIRROR (prototyp bez zmian). Nie zaczynałem nowych rozdziałów.

## Testy (uruchomione 20.11.2026)

| Co | Wynik |
|---|---|
| `npx tsc --noEmit` | OK |
| `npx vitest run` | **52/52 OK**: 19 symulacja i uczciwość MM-01, 14 zagadka i pościg (w tym bot przechodzący pościg z prawdziwym MM-01), 14 Market Replay (brak lookahead, wypełnienia, koszty, ocena), 5 telemetria |
| `node tools/e2e_terminal.mjs` (Chromium) | **OK**: dziennik → zlecenie LONG ze stopem i celem → odsłonięcie → ocena A → nagranie → `sim.finished` → karta końcowa → oceny zapisane w localStorage → raport w schowku; 0 błędów konsoli |
| `node tools/measure.mjs` | OK, trasa benchmarku ukończona (`completedRoute: true`) |

## Pomiary (headless Chromium + SwiftShader, czyli CPU: FPS niemiarodajny)

| | M02 | M03 |
|---|---|---|
| JS (gzip) | 294 KB | 313 KB |
| Tekstury | 564 KB | 564 KB |
| Modele (transfer) | 185 KB (sam Leon) | 794 KB raw / **371 KB gzip** (Leon 456 KB + MM-01 319 KB) |
| Cold TTI | 2,34 s | **2,47 s** (przed optymalizacją shaderów tkanin: 4,8 s) |
| Trójkąty w kadrze (bench) | 41 tys. | ~79–101 tys. |
| Draw calls (bench) | 176 | 110–169 |
| JS heap | 24 MB | 26–30 MB |

FPS na prawdziwym GPU wymaga Twojego `?bench=1`. JSON benchmarku dalej mile widziany, ale nic na niego nie czeka.

## Ograniczenia (uczciwie)

- **Postacie** są wierne conceptowi w sylwetce, kostiumie, palecie i rekwizytach, ale **nie** w jakości twarzy, fałd i tekstur. To sufit metody skryptowej.
  Do jakości concept artu potrzebna jest baza z AI image-to-3D albo artysta (opcje i koszty w style guide). Bez Twojej zgody nic nie kupuję.
- Dave i Kate mają tylko specyfikację i plan, bez modeli.
- Płaszcz MM-01 ma kości pół, ale nie ma symulacji tkaniny: przy ostrych zwrotach nogi mogą przenikać przez poły.
- Brak lip-sync i mimiki (twarze są sztywne). Nagranie Dave'a to dźwięk, fala i napisy, bez jego modelu.
- Market Replay działa na danych **syntetycznych** (oznaczonych). Dane realne dopiero po potwierdzeniu licencji.
- Wydajność na GPU i urządzeniach mobilnych niezweryfikowana w tym środowisku.

## Decyzje dla właściciela

1. **Kolor oka MM-01:** stan percepcji na oku (rekomendacja, obecny stan) czy zawsze czerwone jak w concepcie?
2. **Droga do docelowych postaci:** zgoda na test opcji B (1 miesiąc Tripo lub Meshy, ~$20, kupujesz Ty) i na wysłanie concept artu do tego serwisu?
3. **Propozycje z Creative Review I-1..I-4 i I-5:** dalej niezatwierdzone. Niczego w kanonie nie zmieniałem.

## Następne kroki (propozycja M04)

1. Playtest pościgu z 3–5 osobami na obecnym buildzie, z raportami z karty końcowej. Strojenie parametrami URL.
2. Zależnie od decyzji 2: baza Leona i MM-01 z AI, przepięta na nasz kontrakt; potem Dave i Kate.
3. Domknięcie The Last Shift:
   - wejście do budynku i scena otwierająca przed halą;
   - dźwięk (ambience, muzyka napięcia);
   - polerka światła;
   - jeden przerywnik z Kate (pomoc w ukryciu).
4. Wersja mobilna: sterowanie dotykowe i preset `low` jako szybki test na iPhonie przez przeglądarkę.
