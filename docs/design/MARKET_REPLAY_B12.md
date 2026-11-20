# Market Replay: Terminal B-12 (Milestone 03)

**Status:** grywalny, przetestowany (14 testów jednostkowych + test e2e w przeglądarce).
**Kod:** `game/src/replay/`.
**Pieniądze:** wyłącznie wirtualne. Brak jakichkolwiek połączeń z giełdą, kluczy API, zleceń rzeczywistych i dźwigni.

## Rola w historii (The Last Shift)

1. Po pościgu Leon zamyka się w pokoju terminala. Terminal B-12 otwiera **dziennik Dave'a** („Dziennik D. · wpis 14”):
   Dave zostawił tu przygotowaną wcześniej sesję replay z notatką.
2. Gracz analizuje wykres do punktu decyzji i wybiera **LONG / SHORT / POMIŃ**. Ustala wielkość pozycji, stop-loss i (opcjonalnie) cel. Deklaruje tezę i pewność.
3. Replay odsłania przyszłe świece **pojedynczo**. Gracz może je odtwarzać, zatrzymać, przewijać krokowo i przyspieszać.
4. Ocena oddziela **proces** od **wyniku** (ćwiartka 2×2: dobry proces / zły wynik itd.).
5. Potem odtwarza się **wcześniej nagrana wiadomość Dave'a** (7 kwestii, napisy, wizualizacja fali dźwięku):
   - przeprosiny i ostrzeżenie o nadużyciu PROJECT MIRROR;
   - trop do **The Paper District**;
   - „Szukaj trzeciej drogi”.
6. Kanon jest zachowany: Dave nie handlował. Rozpoznał w logach MIRROR, że takie świece były prowokowane, a nagranie przygotował **przed** porwaniem.

Rozróżnienie realne/fikcyjne: zachowanie rynku na wykresie (trend, kapitulacja, odbicie) jest typowe dla realnych rynków.
**Nadużycie** (prowokowanie ruchów przez MIRROR) jest fikcją fabularną i tak jest podpisane w notatce autora.

## Uczciwość symulacji (sprawdzane testami)

- **Brak zaglądania w przyszłość:**
  - `visible()` zwraca świece tylko do kursora;
  - autoskala osi liczy się wyłącznie z widocznych danych;
  - przyszłość jest w UI zastąpiona pustym obszarem.
- **Wejście** po cenie otwarcia **następnej** świecy plus poślizg.
- **SL/TP** sprawdzane na high/low świecy:
  - gdy obie wartości padną w jednej świecy, wygrywa stop (konserwatywnie);
  - luka cenowa przez stop daje wypełnienie po cenie otwarcia (gorszej).
- **Koszty:** prowizja 10 bps za stronę i poślizg 5 bps przy obu wypełnieniach. Pokazane z góry w podglądzie zlecenia.
- **POMIŃ** to pełnoprawna decyzja i też podlega ocenie.
- **Dane syntetyczne** są wyraźnie oznaczone (`synthetic: true`, źródło i licencja w `DatasetMeta`, napis w UI).
  - Przyszłość generuje się z **zerowym dryfem**, czyli nie jest „ustawiona” pod wynik fabularny.
  - Sesja fabularna: MCX/USD, 4h, seed 417. Do treningu losowe sesje z dowolnego seeda.
- **Dane historyczne rzeczywiste:** dopiero gdy potwierdzimy źródło i licencję. Pola `source`/`license` są na to gotowe.

## Ocena procesu (nie samego PnL)

Kryteria (ocena A–D, wynik 0–100):
- **plan wyjścia (stop):** brak stopu to „zakład, nie decyzja”;
- **ryzyko na transakcję:** ≤2% kapitału dobrze, ≤5% ostrzeżenie, więcej źle;
- **zgodność tezy z kierunkiem;**
- **pewność a wielkość pozycji;**
- **relacja zysku do ryzyka;**
- **świadomość kosztów.**

Wynik (PnL netto po kosztach) pokazany jest osobno. Ćwiartka nazywa sytuację wprost, np. „dobry proces, zły wynik: tak też bywa”.

## Modułowość (kolejne rozdziały)

- `Scenario` = dataset + punkt decyzji + horyzont + okno + kapitał + koszty + opcjonalny wpis dziennika + notatka autora.
  Nowy rozdział to nowy `Scenario` (np. The Paper District) bez zmian w silniku.
- `ReplaySession` (logika), `CandleChart` (wykres canvas, DPR-aware, wolumen, osie, crosshair OHLCV, przeciągalne poziomy) i `Terminal` (UI + przepływ) są rozdzielone. Wykres można użyć osobno, np. w przerywnikach.
- Rozszerzenia przewidziane w typach: wiele instrumentów, inne interwały, journal entries z warunkami fabularnymi.

## Do decyzji / dalsze kroki

- Czy terminal ma mieć tryb „trening” dostępny z menu (już działa jako przycisk w ocenie), czy tylko w fabule?
- Źródło realnych danych historycznych z licencją (np. dane dzienne indeksów z jasną licencją). Bez tego zostajemy przy syntetycznych.
- Playtest: czy 6 kryteriów nie jest za dużo na pierwszy kontakt. Telemetria zapisuje decyzję terminala w raporcie.
