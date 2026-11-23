# Procedura playtestu — The Last Shift (3–5 osób)

**Cel:** zebrać dowody, a nie opinie, w trzech sprawach:
1. Czy pościg jest uczciwy i napięty.
2. Czy zagadka „Waga archiwisty” jest zrozumiała bez podpowiedzi.
3. Czy Terminal B-12 uczy procesu, a nie zgadywania.

Telemetria jest już w grze. Zostaje lokalnie w przeglądarce testera; nic nie jest wysyłane.

## Przygotowanie (5 min na osobę)

- Ten sam build dla wszystkich (link do artefaktu). Przeglądarka Chrome lub Edge, desktop, preset „Średnia”.
- Tester nie dostaje instrukcji poza ekranem startowym. Prowadzący **nie podpowiada**; notuje tylko momenty zawahania.
- Prowadzący zapisuje profil testera: wiek, doświadczenie z grami 2.5D/skradankami (0–3), doświadczenie z tradingiem (0–3).
- Opcjonalnie: nagranie ekranu (OBS) i głośne myślenie („mów, co myślisz”).

## Przebieg (25–35 min)

1. **Rozgrywka od początku** (hala, korytarz, zagadka, pościg, terminal, nagranie Dave'a). Bez limitu czasu.
2. Na karcie końcowej tester:
   - wypełnia **6 ocen 1–5** (napięcie, uczciwość złapań, czytelność MIRROR, zagadka, terminal, postacie);
   - wpisuje uwagi;
   - klika **„Kopiuj raport”** albo **„Pobierz JSON”** i przesyła plik prowadzącemu.
3. **Symulator B-12 (trening)** z menu: 3 scenariusze o podanych ID, żeby porównywać testerów na tych samych danych:
   - `trend-up-1201`, `panic-6637`, `no-edge-9953`.
4. Krótki wywiad (5 min):
   - Kiedy zostałeś złapany — czy wiedziałeś dlaczego?
   - Co znaczył napis MIRROR nad bramą?
   - Czy w terminalu ocena procesu była sprawiedliwa? Czy coś zaskoczyło?
   - Jedna rzecz, którą byś zmienił.

## Co liczymy z raportów JSON

| Pytanie | Pole w raporcie | Próg alarmowy |
|---|---|---|
| Gdzie gracze giną | `catches[].segment`, `x`, `lane` | > 3 złapania w jednym odcinku u ≥ 2 osób |
| Czy ostrzeżenie bramy działa | `gateWarnings[].dodged` | uniknięte < 50% |
| Czy pościg jest uczciwy | `catches[].sinceGateWarn` + ocena „fair” | ocena ≤ 2 u ≥ 2 osób |
| Czy trzecia droga jest odkrywana | `actions.ductEntries`, `chase.laneSeconds.tunnel` | nikt nie użył kanału |
| Czas zagadki | `segments[]` (odcinek `ledge` / `corridor`) | mediana > 6 min |
| Terminal | `terminal.decision.grade`, `training[]` | ocena „terminal” ≤ 2 lub brak zrozumienia oceny procesu |

**Znaczniki złapań:** po wczytaniu raportów w tej samej przeglądarce widok techniczny (**T**) pokazuje krzyżyki w miejscach złapań; wcześniejsze sesje są przygaszone.

## Strojenie po playteście (bez przebudowy)

Parametry URL, zapisywane w raporcie:

| Parametr | Zakres | Działanie |
|---|---|---|
| `warn` | 0,3–3 s | czas ostrzeżenia bramy |
| `mmspeed` | 2,5–6,5 | prędkość MM-01 w pościgu |
| `gap` | 1–8 | minimalny dystans wyjścia z korytarza serwisowego |
| `stepout` | 0,2–2,5 s | sygnał przed wyjściem MM-01 |
| `respawn` | 4–25 | dystans MM-01 po odrodzeniu |
| `closed` | 2–12 s | czas zamknięcia bramy |

**Zasada:** jedna zmiana na rundę, ta sama grupa scenariuszy. Decyzja rozwijamy / zmieniamy / odpuszczamy zapada na podstawie progów z tabeli powyżej.

## Benchmark wydajności (osobno, na sprzęcie testerów)

`?bench=1` na buildzie → wynik do skopiowania z karty końcowej. Liczy się tylko pomiar na prawdziwym GPU; liczby z renderowania programowego w CI nie są miarą wydajności.
