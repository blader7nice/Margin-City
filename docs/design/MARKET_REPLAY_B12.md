# Market Replay: Terminal B-12 (wersja 2.0 — Milestone 04)

**Status:** grywalny, przetestowany (28 testów jednostkowych replay + e2e w przeglądarce: fabuła i trening).
**Kod:** `game/src/replay/`.
**Pieniądze:** wyłącznie wirtualne. Brak jakichkolwiek połączeń z giełdą, kluczy API, zleceń rzeczywistych i dźwigni.


## Co nowego w 2.0 (M04)

**Biblioteka 12 sytuacji** (`src/replay/market.ts`):
- trend wzrostowy, trend spadkowy, konsolidacja, wybicie, powrót po wybiciu, panika, dynamiczne odbicie, zmiana struktury, brak przewagi, nadmierna zmienność, ściśnięcie zmienności, euforia;
- **ID = rodzina-seed** (np. `panic-6637`): ten sam ID zawsze daje te same świece; opisy mówią tylko, co widać, nigdy, co będzie.

**Model rynku 2.0:**
- grube ogony (t-Studenta), klasterowanie zmienności, ścieżki wewnątrz świecy, luki, wolumen zależny od ruchu;
- przyszłość losowana dla każdego seeda, z co najwyżej słabymi, udokumentowanymi tendencjami (momentum ρ ≤ 0,3, powrót do średniej w konsolidacji);
- test: w każdej rodzinie 20–80% seedów kończy się wzrostem, czyli nie ma ustawionego wyniku.

**Analiza kontekstu z widocznych świec** (`analysis.ts`):
- trend z R², struktura, zakres, wybicie i nieudane wybicie, klimaks liczony względem rynku sprzed ruchu, świeca odwrócenia, odreagowanie, ściśnięcie, zmienność;
- obserwacje opisane po polsku.

**Ocena 2.0** (`evaluate.ts`), trzy osobne części:
1. **Proces.** Kryteria: zgodność tezy z obserwowanym kontekstem, ryzyko %, stop względem ATR i struktury, zysk:ryzyko, niepewność (pewność a dowody), wielkość a warunki, konsekwencja planu, koszty. Do tego progi: teza bez pokrycia → maks. C; częściowo potwierdzona → maks. B; brak stopu lub ryzyko > 5% → maks. D; odsunięcie stopu po wejściu → maks. C. Pominięcie oceniane według tego, czy była przewaga.
2. **Wynik:** PnL netto po kosztach, R, MAE/MFE.
3. **Komentarz:** co było widać, co najmocniej wspierały dane, gra przeciw trendowi, co zrobił rynek (z zastrzeżeniem, że nie dało się tego wiedzieć) oraz **ten sam plan w 200 alternatywnych przyszłościach tego samego modelu**, dostępne tylko po odsłonięciu.

**Przypadek z testu właściciela:** LONG w silnym trendzie spadkowym z tezą „kapitulacja” bez potwierdzenia i z dobrym zarządzaniem ryzykiem dostaje teraz **B**, a nie A. Z wysoką pewnością: C/D (test automatyczny).

**Platforma** (`terminal.ts`, `chart.ts`):
- zoom kółkiem, przesuwanie, „Dopasuj”, MA20/MA50, legenda OHLCV, crosshair z ceną i czasem;
- linia wejścia, przeciągane SL/TP także przy otwartej pozycji, stop na wejście (BE), zamknięcie po otwarciu następnej świecy;
- wielkość pozycji wg ryzyka % albo % kapitału (bez dźwigni);
- tekst skaluje się z rozdzielczością.

**Fabuła a trening:**
- sesja Dave'a raz na przejście, a nagranie nie odtwarza się ponownie; później terminal w grze otwiera trening;
- trening także z menu („Symulator B-12 · trening”), `?terminal=train` albo `?replay=<ID>`;
- lokalna historia ostatnich sesji.

**Testy look-ahead** (`tests/replay2.test.ts`):
- wskaźniki są przyczynowe;
- odczyt kontekstu i **ocena procesu identyczne dla dowolnej przyszłości**;
- wykres nie dostaje świecy spoza kursora;
- alternatywne przyszłości są niedostępne przed decyzją.

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
