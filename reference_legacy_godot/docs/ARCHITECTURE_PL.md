# MARGIN CITY — ARCHITEKTURA I PLAN IMPLEMENTACJI v0.1

## 1. Stos techniczny

**Uwaga:** `demo-web/index.html` to osobny prototyp wrażenia z gry, służący do szybkiego przetestowania sterowania i AI bez instalacji Godot. To NIE druga produkcyjna implementacja; nie rozwijamy go w nieskończoność. Jedynym źródłem kodu docelowej gry pozostaje projekt Godot.


- **Godot 4.6 Standard**, **GDScript**, renderer **Compatibility / WebGL 2.0** dla web.
- Level jako `Node3D` ze statycznymi kolizjami, Player jako `CharacterBody3D`.
- Brak backendu i zewnętrznego API w MVP.
- Wersjonowanie: **Git**, archiwum projektu jako punkt startowy, opcjonalnie prywatne repo.
- Docelowy pipeline 3D: Blender → glTF 2.0 → Godot; w prototypie wyłącznie bryły proceduralne.
- Stan v0.1: pojedynczy level. Przed rozbudową wydzielić sceny i konfigurację.

**Dlaczego?** Jeden język, uproszczona iteracja scen i eksport natywny na późniejszy telefon. Koszt: web export ma ograniczenia względem desktopu. Od początku testować Compatibility zamiast produkować efekty tylko dla Vulkan/Forward+.

## 2. Architektura logiczna

```text
                    [Game / Mission Session]
                    /                   \
          [World / Camera]         [Market Replay]
           /    |      \\            /          \
       Player  Enemy    Level      DataSource   Simulator
        |    Perception  Rules       (fixture)   (pure)
      Input    FSM       |              \          /
         \____ HUD & Feedback _________Trading Terminal
```

### W v0.1

| Plik | Odpowiedzialność | Dług techniczny |
|---|---|---|
| `scripts/main.gd` | Scene bootstrap, greybox, misja, HUD | Zbyt duży — podzielić po zatwierdzeniu feelingu |
| `scripts/player.gd` | Movement + hiding | Brak animacji, gamepad/touch, remapowania klawiszy |
| `scripts/inspector_ai.gd` | State machine / LOS / hearing | Brak ścieżek, zasłon, wiele postaci |
| `scripts/trading_chart.gd` | Rysowanie OHLC | Brak osi z timestamp/price i tooltipów |
| `scripts/replay_engine.gd` | Deterministyczny paper PnL | Założone egzekucje, brak SL/TP |
| `data/trading_synthetic.json` | Dane testowe | **Syntetyczne**. NIE używać jako autentycznych notowań |

### Po pozytywnym teście

Wydzielić `PlayerController`, `CameraDirector` (shot volumes), `GuardPerception`, `GuardStateMachine`, `MissionManager`, `TradingTerminal`, `IDataSource`/`HistoricalFixtureProvider`, `ReplaySimulator`, `SaveService`. Komunikacja przez sygnały zamiast bezpośredniego dostępu do globalnych singletonów.

## 3. Dane rynkowe — bez błędów metodologicznych

Minimalny kontrakt przyszłego pliku:

```json
{
  "metadata": {
    "symbol": "BTC/USDT",
    "asset_class": "crypto",
    "venue": "EXCHANGE_NAME",
    "timezone": "UTC",
    "interval": "5m",
    "provider": "PROVENANCE_REQUIRED",
    "is_synthetic": false,
    "license_reviewed": false,
    "decision_index": 100,
    "replay_end_index": 120
  },
  "candles": [
    {"timestamp": "YYYY-MM-DDTHH:mm:ssZ", "o": 0, "h": 0, "l": 0, "c": 0, "v": 0}
  ]
}
```

Kontrakt to *specyfikacja* — powyższe zera i nazwy nie są prawdziwą próbką danych. Przed wdrożeniem potrzebny adapter weryfikujący interwały, kolejność, brakujące świece, split/dividend adjustments (akcje), sesje giełdowe, źródło i zgodność licencyjną. Nie mieszamy cen z wielu venue. Zmienna `license_reviewed` ma być rzeczywiście audytowana, nie automatycznie ustawiana na true.

**Reguła bez lookahead bias:** gracz nie zna żadnej świecy ani statystyki policzonej z przyszłego odcinka. Skalowanie wykresu przed decyzją korzysta tylko z już odsłoniętych świec. Okno wybieramy z wcześniej zatwierdzonego zestawu, a nie pod wynik gracza. Po decyzji prezentujemy kolejne dane. **No trade** jest prawidłową decyzją. Opłaty/slippage jawnie widoczne.

**Własne cele edukacyjne:** pierwszy moduł: LONG/SHORT/POMIŃ i wpływ kosztów; następny: stop loss, risk/reward, size. Nie nagradzamy samych dużych procentowych zysków — takie wyniki bez kontroli ryzyka wzmacniają hazardowe zachowania.

## 4. Wymagania dla przeglądarki

- Wczesne testy Chromium/Firefox i Safari; nie zakładać automatycznie identycznego renderingu.
- **WebGL 2.0** i renderer Compatibility; brak C# w web export Godot 4.
- Preferować lekkie, wypiekane oświetlenie, proste materiały, ograniczone draw calls i małe paczki assetów.
- IndexedDB może wpływać na trwałość zapisu na web; zapisy powinny mieć mechanizm błędu i eksportu danych gracza.
- Mobile docelowo: osobny budżet wydajności, test sterowania dotykowego i wielkości UI. Native Android/iOS nie jest „jednym kliknięciem” gwarantującym identyczny UX.

## 5. Backlog / sekwencja z bramkami jakości

**P0 — Uruchomienie:** otworzyć `project.godot`, uruchomić na desktopie, naprawić parser/runtime errors. Run validator fixture. Zrzut ekranu i krótkie nagranie z gry.

**P1 — Feel movement:** przetestować ruch, skok, przyspieszenie/wyhamowanie, bezkolizyjność tła i widoczność bohatera. Dodać coyote time / jump buffer dopiero po zaobserwowaniu problemu.

**P2 — Stealth feedback:** wskaźnik podejrzenia, sygnał dźwiękowy przy wykryciu, ostatnia znana pozycja i powrót do patrolu. Testy „ściana blokuje wzrok”, „kryjówka działa”, „bieg z tyłu wywołuje podejrzenie”.

**P3 — Reżyserowane pościgi:** jedna scenka chase, poprawne restartowanie, oddalenie kamery przy sprintach, żadnych ślepych skoków.

**P4 — Market replay:** testy logiki kosztów, dobór próbek historycznych z prawami do użycia, weryfikacja no-lookahead, możliwość POMIŃ, nieblokujący wynik.

**P5 — Vertical slice:** jedna artystycznie dopracowana lokacja 10–15 min, 1 przeciwnik, narracyjny cel i polski/angielski UI.

**P6 — Web QA:** export, uruchomienie na lokalnym serwerze, test Chrome/Firefox/Safari, pomiar FPS, pamięci i wielkości pobieranych zasobów. Dopiero potem decyzja o rozszerzaniu projektu.

## 6. Automatyczne i ręczne testy

- `python tools/validate_fixture.py` — sprawdza poprawność 20 syntetycznych świec i wynik PnL z opłatami.
- `node tools/check_web_demo.cjs` — bez bibliotek zewnętrznych sprawdza wykonanie renderu testowego i 8-krokowego LONG replay w demonstratorze HTML.
- W Godot (po instalacji): `godot --headless --path . --editor --quit` — import/składnia, a następnie `godot --headless --path . --quit-after 120` — krótki test uruchomienia. Na Windows nazwa wykonywalna może być inna.
- Ręcznie: ① ruch i skok ② schowanie przy znaczniku ③ wykrycie przy biegu ④ pościg ⑤ złapanie i reset ⑥ dotarcie do terminala ⑦ każdy z LONG/SHORT/POMIŃ osobno po restarcie ⑧ zgodność PnL z walidatorem ⑨ brak przyszłych świec przed wyborem ⑩ browser export.

**Warunek przejścia etapu P0:** zero błędów parsera i nieobsługiwanych wyjątków; startup i przejście misji działają na docelowym środowisku.

## 7. Ryzyka krytyczne i kontrposunięcia

| Ryzyko | Ocena | Działanie |
|---|---|---|
| Projekt AAA dla 1 osoby | Krytyczne | Vertical slice zamiast kampanii i setek assetów |
| Wydajność WebGL 2.0 | Wysokie | Compatibility od pierwszego dnia, testy web na niskim sprzęcie |
| AI unfair/telepatyczne | Wysokie | LOS, pamięć, reakcja z opóźnieniem, jawna obserwowalność |
| Zmiana widoku psuje sterowanie | Wysokie | Lane X/Y, stopniowe shot transition, playtest pościgu |
| Prawa do danych giełdowych | Wysokie | Testy synthetic; potem uzgodnienie licencji i źródła per asset class |
| Hazardowe bodźce tradingowe | Wysokie | Brak realnych środków, wybór POMIŃ, scoring jakości ryzyka |
| Wygenerowany kod bez integracji | Wysokie | Małe zadania Claude Code, testy i review każdego PR |

## 8. Kryterium ekonomiczne

Nie kupujemy teraz płatnych assetów, subskrypcji danych rynkowych ani backendu. Pierwsza istotna inwestycja dopiero po grywalnym teście zrealizowanym przez **kilku zewnętrznych testerów**. Jeśli stealth jest słaby, dokładanie grafiki tylko podniesie koszt utopiony.
