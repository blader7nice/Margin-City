<!-- Canon refresh 2026-11-19: canonical story; source of truth over legacy GDD and legacy art. Technology choice and prior review items are pending technical/owner sign-off. -->
# MARGIN CITY: THE LAST SIGNAL
## MASTER STORY & GAME DESIGN BIBLE — v1.1 (PL)

**Data konsolidacji:** 19.11.2026  
**Właściciel wizji i finalnych decyzji:** twórca gry  
**Przeznaczenie:** wspólne źródło prawdy dla twórcy, ChatGPT i Claude Code.  
**Etap:** technical decision and production kickoff; coding of approved milestones is encouraged after owner sign-off.

### Jak interpretować ten dokument
- **[ZATWIERDZONE]** — wiążąca decyzja twórcy. Zmiana wymaga wyraźnej akceptacji.
- **[ROBOCZE]** — propozycja do rozwinięcia i krytyki; nie jest zamrożona.
- **[OTWARTE]** — potrzebna decyzja lub test.
- **[NIEAKTUALNE]** — stary wariant, którego nie wolno przywracać jako kanonu.

> **Reguła nadrzędna:** jeżeli jakikolwiek starszy GDD, Visual Bible, prototyp, ilustracja albo plik instrukcji jest sprzeczny z tym dokumentem, w części fabularnej i projektowej pierwszeństwo ma niniejsza wersja. Nie przerabiaj automatycznie starego kodu — najpierw audyt i zgoda właściciela.

---

# 1. WIZJA PRODUKTU

**[ZATWIERDZONE]** Samodzielna kampania narracyjna w grze **single-player** o charakterze cinematic 2.5D, z trójwymiarowymi środowiskami, dynamiczną lecz czytelną kamerą, zręcznościowym ruchem, skradaniem, pościgami, zagadkami środowiskowymi oraz edukacyjnym Market Replay na wirtualne środki.

**Emocjonalna obietnica:** „Odnajdź porwanego starszego brata w zachwycającym, niepokojącym mieście finansów; przetrwaj polujących na ciebie strażników i odkryj, jak wiedzę o zachowaniach inwestorów zamieniono w narzędzie nadużyć”.

**Filary rozgrywki — priorytet (kolejność ważności):**
1. Skradanie, pościgi, wiarygodne reakcje przeciwników i napięcie.
2. Mocna fabuła, tajemnica i relacja braterska; ciekawość, „co wydarzy się dalej”.
3. Zręczność / platforming i pomysłowe zagadki, których rozwiązanie wynika z obserwacji otoczenia.
4. Market Replay jako część śledztwa i nauki psychologii rynku, **nie** dominujący symulator.

**[ZATWIERDZONE]** Inspiracje estetyczne: około **80% nastroju, detaliczności i atmosfery Unravel Two + 20% energii i zmienności sekwencji It Takes Two**. Klimat pięknej, lekko mrocznej baśni z thrillerem/horrorem. **To punkty odniesienia, nie instrukcja kopiowania cudzych postaci, poziomów, sylwetek, interfejsów, muzyki ani assetów.**

**[ZATWIERDZONE]** Komputerowa przeglądarka jako pierwszy kanał dystrybucji; później telefon / potencjalnie iPhone. Twórca pracuje solo z pomocą ChatGPT i Claude Code, bez budżetu na początku, gotów ponieść uzasadnione wydatki później.

**[ROBOCZE]** Docelowa kampania w sześciu rozdziałach; rangi i wydarzenia mogą dojść później. Żaden harmonogram ani pełna długość kampanii nie zostały zatwierdzone.

# 2. KANON — TOŻSAMOŚĆ, RELACJE I NAZWY

| Element | Aktualny kanon | Status |
|---|---|---|
| Tytuł | **MARGIN CITY: THE LAST SIGNAL** | [ZATWIERDZONE jako kierunek, do kontroli praw do nazwy przed premierą] |
| Protagonista sterowany przez gracza | **Leon**, 23 lata, młodszy brat | [ZATWIERDZONE] |
| Zaginiony starszy brat | **Dave**, 33 lata, analityk / projektant części systemu; ma zarost | [ZATWIERDZONE] |
| Sojuszniczka | **Kate**, 31 lat, partnerka Dave'a, pracownica korporacji, potajemna pomoc dla Leona | [ZATWIERDZONE] |
| Główny antagonista | **Marcus Maker**, człowiek nadzorujący wykorzystanie systemu | [ZATWIERDZONE] |
| Inspektor | **MM-01**, podległy Marcusowi cyberpunkowy strażnik | [ZATWIERDZONE] |
| System | **PROJECT MIRROR** | [ZATWIERDZONE] |
| Prolog | **The Third Way** — dziecięca biblioteka-labirynt | [ZATWIERDZONE] |
| Pierwsza misja | **The Last Shift** — opuszczony kompleks finansowy, terminal B-12 | [ZATWIERDZONE] |
| Postacie późniejszych rozdziałów | **Smart Money** i **Whale** | [ROBOCZE, bez zatwierdzonego wyglądu/roli] |
| Nazwa prawna korporacji | np. „Margin Capital Group” | [ROBOCZE — NIE zamrażać] |

**Najważniejsze ograniczenie fabularne [ZATWIERDZONE]:** Dave **nie jest winny procederu i nie wiedział** o rzeczywistym wykorzystaniu swojej pracy. Tworzył model analizy zachowań i psychologii inwestorów do uprawnionych celów. Po odkryciu nadużyć został porwany. **Nie** był ukrytym mastermindem manipulującym Leonem, **nie** odpowiada świadomie za oszustwo i **nie** reżyseruje późniejszych działań z ukrycia. Przygotował wskazówki **przed porwaniem**. Obaj bracia przeżywają i pomagają ujawnić proceder poprzez dowody oraz publiczną edukację o psychologii rynku.

**[NIEAKTUALNE]** Historia o finansowym ratowaniu rodziny; wariant, w którym Dave/Leon świadomie uczestniczył w oszustwie; wcześniejszy zaginiony „Leon” i grywalny „Elias” lub „Dave”; sojuszniczka „Mira”; dawna nazwa systemu. Wspomniana wcześniej stacja kolejowa jako miejsce dziecięcej zabawy **nie** jest obowiązującym prologiem.

# 3. GŁÓWNA INTRYGA I STAWKI

**[ZATWIERDZONE]** Leon jedzie do Margin City szukać starszego brata, który zniknął po pracy przy systemie PROJECT MIRROR. Dave zauważył, że kierownictwo korporacji wykorzystuje analizy emocji, przepływów kapitału i zachowań inwestorów do projektowania nadużyć informacyjnych oraz prób manipulacji otoczeniem rynkowym. Przed porwaniem zdążył przygotować tropy: wpisy dziennika powiązane z historycznymi wykresami, identyfikatory archiwów, zaszyfrowane odniesienia do wspólnych wspomnień braci oraz nagrania. Leon, rozwiązując zagadki, stopniowo odnajduje prawdę i miejsce przetrzymywania Dave'a.

**[ZATWIERDZONE]** Kate kocha Dave'a. Jako 31-letnia pracownica korporacji i osoba mająca częściowy dostęp do informacji prowadzi podwójne życie: publicznie zachowuje lojalność, potajemnie pomaga Leonowi w poszukiwaniach. **Pojawia się okazjonalnie**, nie jest stale towarzyszącą postacią. Nie może po prostu zdradzić wszystkich tajemnic: grozi jej dekonspiracja i utrata dostępu; sama dysponuje niepełnymi informacjami. Ryzyko i zawodowe ograniczenia muszą być realne, a jej działania mogą mieć nieplanowane konsekwencje.

**[ROBOCZE — do dopracowania]** Kate inicjuje kontakt anonimową wiadomością podpisaną „K.”, a Leon otrzymuje też wcześniejszy ślad od Dave'a prowadzący do B-12. Przyczyna oraz technika doręczenia drugiej wiadomości muszą zostać logicznie wyjaśnione (np. wcześniej zaplanowany bezpieczny mechanizm lub odblokowanie archiwalnego nagrania); żadnych magicznych wiadomości wysyłanych po porwaniu. Gracz nie powinien poznać prawdziwej tożsamości „K.” natychmiast.

**[ROBOCZE]** Kierownictwo przetrzymuje Dave'a, ponieważ potrzebuje jego wiedzy dotyczącej określonego krytycznego elementu MIRROR i chce odzyskać ukryte dowody. To jest uzasadnienie wymagające stress-testu: po co więzić go żywego, dlaczego nie odcięto go wcześniej, w jakich granicach może pomóc lub przeszkodzić? Nie wolno rozwiązywać tej luki wyłącznie wszechmocą antagonistów.

**[ZATWIERDZONE]** Ostatecznie Leon uwalnia Dave'a; w finale mogą działać razem (Dave jako postać pomocnicza sterowana przez AI — gra nadal single-player). Obaj przeżywają, zabezpieczają dowody i przekazują je mediom / niezależnym podmiotom; mówią publicznie o działaniu wykresów, emocjach, psychologii cyklu i ograniczeniach przewidywania. **Nie** ogłaszamy, że każde wydarzenie rynkowe jest manipulacją ani że model cyklu przewiduje przyszłą cenę.

# 4. POSTACIE — FUNKCJA, WYGLĄD, MOTYWACJA

## Leon, 23 — gracz [ZATWIERDZONE]
- Stylizowany młody człowiek, niewielki w monumentalnym świecie; sylwetka czytelna z oddalonej kamery; swobodny, ludzki ubiór, torba lub mały plecak, buty do eksploracji.
- Rozpoczyna jako dociekliwy i niedoświadczony; zamiast siły wykorzystuje obserwację, spokój, kryjówki, improwizację i zagadki znane z dzieciństwa.
- Podstawowa motywacja: **odnaleźć Dave'a**. Pieniądze są wyłącznie wirtualną mechaniką, nie powodem wyprawy.
- Towarzyszy mu mosiężny kompas podarowany przez Dave'a w bibliotece. Nie jest magicznym wykrywaczem rozwiązania.
- [OTWARTE] Paleta stroju i rysy twarzy — istnieją stare, nieaktualnie opisane concept arty; nie przypisywać ich automatycznie do Leona bez zatwierdzenia.

## Dave, 33 — starszy brat / stawka emocjonalna [ZATWIERDZONE]
- Starszy o 10 lat; widoczny **zarost**; rodzinne podobieństwo do Leona, dojrzalsza twarz, zwykły ludzki strój analityka, ciepła prezencja.
- Niewinny specjalista od analizy zachowań i modeli danych, partner Kate. Po odkryciu nadużyć zgromadził dowody, przygotował wskazówki i został porwany.
- Jego nauczycielska rola: w dzieciństwie uczy Leona zadawać pytania, wybierać „trzecią drogę” i obserwować otoczenie. W finale obaj dzielą się wiedzą z opinią publiczną.
- [ROBOCZE] Relacja braci była bliska, lecz ostatni kontakt przed zaginięciem był napięty; ich pojednanie ma emocjonalnie wybrzmieć, nie być automatyczne.

## Kate, 31 — podwójne życie [ZATWIERDZONE]
- **Długie, blond, bardziej kręcone włosy**; kobiecy, elegancki, lecz praktyczny strój.
- Wyposażenie to **kobieca torebka**, z której może dyskretnie wyciągać przydatne narzędzia, klucze, miniaturowe urządzenia czy dokumenty; torebka jest rozpoznawalnym rekwizytem i źródłem okazjonalnych interakcji.
- Kocha Dave'a, boi się o niego, prosi Leona o pomoc, nadal pracuje dla korporacji. Nie ufa automatycznie każdemu krokowi Leona, spotyka go rzadko i pod przykrywką.
- [OTWARTE] Stanowisko służbowe, stopień dostępu i czy korporacja zna jej związek z Dave'em. To wpływa na wiarygodność działania na dwa fronty.

## Marcus Maker — antagonista [ZATWIERDZONE rola, ROBOCZY wygląd]
- Główny człowiek stojący za nadużywaniem MIRROR; wyrachowany, wpływowy, zdolny do racjonalizowania swoich decyzji.
- Nie jest dosłowną personifikacją całego market makingu. **Normalny market making jest działalnością polegającą na dostarczaniu płynności; oszustwo Marcusa jest fikcyjnym nadużyciem, a nie twierdzeniem, że wszyscy market makerzy manipulują.**
- [OTWARTE] Struktura władzy, motywacja inna niż sam zysk, sposób sprawowania kontroli nad MM-01.

## MM-01 — Corporate Warden / Inspektor [ZATWIERDZONE]
- Wysoki, smukły, długi grafitowy korporacyjny płaszcz, precyzyjne ruchy. **Twarz ma być wyraźnie pół-ludzka, pół-cybernetyczna: widoczne ludzkie rysy i mimika przeplatane implantami przy oku, skroni oraz szczęce. Nie zakrywać całej twarzy gładkim hełmem / pełnym wizjerem.**
- Groźny przez cierpliwą obserwację i precyzję, nie przez nieprzerywane jumpscare'y.
- Stan AI w prototypie: Patrol → Suspicion → Chase → Search → Return. Reakcja na widoczność, dźwięk i ostatnią znaną pozycję; zakaz widzenia przez ściany lub teleportowania do gracza.
- [ROBOCZE] Warianty MM w późniejszych rozdziałach.

## Smart Money / Whale [ROBOCZE]
- Dwie potencjalne postacie drugoplanowe lub siły mające własne motywacje. Nie przyjmować odgórnie, że Smart Money to dobra postać, a Whale zły boss. Nie rozbudowywać ich w pierwszej misji.

# 5. ŚWIAT, KAMERA, OPRAWA

**[ZATWIERDZONE]** Monumentalne Art Deco, ciepłe naturalne materiały i światło w bezpiecznych / wspomnieniowych przestrzeniach, chłodne odcienie i dyskretna technologia nadzoru w infrastrukturze MIRROR. Cyberpunk przede wszystkim w MM-01, urządzeniach monitoringu i sterylnych obiektach korporacji; nie całe miasto zalane neonem.

**[ZATWIERDZONE]** Kamera cinematic hybrid 2.5D: poruszanie głównie po zaprojektowanych płaszczyznach, kontekstowe ruchy w głąb sceny, filmowe najazdy i kąty. Rozgrywka zawsze wygrywa z widowiskowością — po zmianie kadru sterowanie pozostaje przewidywalne, przeszkody i miejsca lądowania są widoczne.

**[ROBOCZE]** Paleta: ciemny granat, stal, mglisty turkus, bursztynowe światło, zimny cyjan. Kontrast, czytelność bohatera, dźwięk i reżyseria ujęć ważniejsze niż liczba efektów. **Concept arty to referencje wizualne, nie gotowe modele 3D ani assety.** Wcześniejsze arkusze mogły używać błędnych imion i wyglądu — wymagają audytu przed wykorzystaniem.

# 6. STORYBOARD: PROLOG „THE THIRD WAY” (około 7–9 minut)

**[ZATWIERDZONE]** Wspomnienie sprzed 15 lat: Leon 8 lat, Dave 18 lat. Miejscem jest stara, piękna, duża **biblioteka-labirynt**, nie stacja kolejowa. Dave przygotował zagadki ukryte w ciekawych książkach i uczy Leona obserwacji oraz skradania się przed **surową, lecz nie złowrogą bibliotekarką**, która reaguje na hałas / głośne rozmowy. W nagrodę Leon otrzymuje mosiężny kompas.

### P01 — Wejście do biblioteki (0:45)
- **Obraz / kamera:** szeroki kadr na wysokie półki, złote światło, zbliżenie na braci; naturalne cięcia do grywalnego ujęcia bocznego.
- **Gracz:** ruch, podążanie za Dave'em; Dave jest prowadzony skryptem/AI bez konieczności współpracy drugiego gracza.
- **Emocja:** ciepło, ciekawość.
- **Dialog roboczy:** „Gdybym ci powiedział, nie byłoby zagadki”.

### P02 — Książki jako wskazówki (1:30)
- **Obraz:** duże regały, ruchome drabiny, widoczne symbole na grzbietach.
- **Gracz:** znajduje wskazówkę w jednej z książek; prosty interfejs interakcji, bez zalewu tekstu.
- **Emocja:** satysfakcja z samodzielnego odkrycia; zero zgadywania bez informacji.

### P03 — Dwie fałszywe drogi i antresola (2:00)
- **Obraz:** dwie widoczne trasy okazują się zamknięte; kamera delikatnie ujawnia ruchomą drabinę i antresolę (nie podaje całego rozwiązania).
- **Gracz:** odnajduje trzecią drogę, przesuwa drabinę, przechodzi dalej.
- **Dave:** „Kiedy widzisz dwie drogi, zawsze poszukaj trzeciej”.
- **Emocja:** sprawczość; zasada powracająca w stealth i market replay.

### P04 — Bibliotekarka i pierwszy stealth (2:00)
- **Bodziec:** Leon i Dave zbyt głośno rozmawiają / przewracają książki, przyciągając bibliotekarkę.
- **Gracz:** kucanie, czekanie, ukrycie za regałem, obserwacja kierunku patrolu.
- **Porażka:** bibliotekarka poucza braci i odsyła do stołu; checkpoint blisko, bez drastycznej kary.
- **Emocja:** lekki dreszcz z humorem, nie horror. Bibliotekarka nie jest antagonistką.

### P05 — Kompas od Dave'a (1:00)
- **Obraz:** niewielka czytelnia, bursztynowe światło, pudełko przypominające książkę.
- **Gracz:** odbiera kompas, krótka interakcja z bratem, ciepła scena bez długiego filmiku.
- **Dave:** „Nie zawsze pokaże ci drogę. Ale przypomni, żebyś szukał własnej”.

### P06 — Przejście do teraźniejszości (1:00–1:30)
- **Kamera:** match cut kompasu dziecka → kompas trzymany przez dorosłego Leona.
- **Obraz:** nocny pociąg, deszcz, panorama Margin City po wyjeździe z tunelu.
- **Fabuła:** Leon ma anonimowy kontakt podpisany „K.” oraz wcześniejszy trop od Dave'a prowadzący do Terminala B-12. Nie ujawniamy od razu, kim jest „K.”.
- **Tytuł:** MARGIN CITY: THE LAST SIGNAL.

**Warunek jakości:** gracz po 8 minutach powinien rozumieć relację braci, móc sam wskazać zasadę „trzeciej drogi” i znać podstawy czekania / kryjówki.

# 7. STORYBOARD: MISJA 01 „THE LAST SHIFT” (około 20–25 minut)

**[ZATWIERDZONE]** Nocna monumentalna hala finansowa i archiwum. Leon szuka Terminala B-12. Pierwsze prawdziwe starcie z MM-01; jedna bezpieczna sesja Market Replay; nagranie Dave'a i trop prowadzący do **The Paper District**. Finał nie zdradza jeszcze wprost całego losu Dave'a.

### M01 — Wejście techniczne (2:00)
- **Cel:** wejść do nieczynnego kompleksu i rozpoznać trasę do archiwum.
- **Rozgrywka:** ruch, skok, prosty element środowiskowy; piękny, ogromny świat, Leon mały w kadrze.
- **Kamera:** panorama fasady → boczny widok gameplay.
- **Wskazówka:** subtelne oznaczenia związane z PROJECT MIRROR; ich znaczenie ujawni się później.

### M02 — Pierwszy MM-01 (3:00)
- **Cel:** przeczekać pierwszy patrol bez bezpośredniej konfrontacji.
- **Obraz:** bliskie ujęcie częściowo ludzkiej, częściowo mechanicznej twarzy; potem czytelny szeroki kadr patrolu.
- **Głos roboczy:** „Unregistered movement detected”.
- **AI:** reaguje na konkretny bodziec, nie zna od razu położenia Leona.

### M03 — The Silent Hall (5:00)
- **Cel:** przejść przez strefę nadzorowaną.
- **Opcje:** przejście za ladami; przejście strefą serwisową; odwrócenie uwagi dźwiękiem. Co najmniej dwie uczciwe możliwości, trzecia nagradza obserwację.
- **AI:** patrol/suspicion/search; po zgubieniu gracza bada ostatnio znaną pozycję.
- **Checkpoint:** bezpieczna wnęka przed strefą; powtórka po wykryciu bez ponownego odgrywania dialogów.

### M04 — The Broken Passage (3:00)
- **Cel:** uruchomić przejście do archiwum za pomocą platformy/przeciwwagi i uszkodzonego mechanizmu.
- **Ryzyko:** panel wyraźnie sygnalizuje, że odblokowanie uruchomi alarm. Gracz wie, skąd bierze się pościg.
- **Kamera:** skośne ujęcie, wciąż czytelne sterowanie i miejsce lądowania.

### M05 — The Chase (3:00)
- **Cel:** uciec przed MM-01 i zamknąć drzwi prowadzące do archiwum.
- **Mechanika:** skok przez szczelinę, ślizg pod bramą, alternatywny tunel techniczny; dynamiczna kamera bez skokowych zmian sterowania.
- **Porażka:** krótki checkpoint; nie karzemy długim powtarzaniem wprowadzenia.
- **Dźwięk:** kroki MM-01, alarm, zmiana muzyki; tempo, ale nie chaos.

### M06 — Terminal B-12 (4:00)
- **Cel:** odnaleźć wpis Dave'a, zrozumieć pierwszy fragment historii; wykonać Market Replay (LONG, SHORT albo POMIŃ).
- **UI:** profesjonalnie wyglądający, czytelny terminal; opis daty, źródła, instrumentu, osi ceny/czasu i wolumenu; 40–80 historycznych świec widocznych przed podjęciem decyzji.
- **Fabuła:** wskazówka/archiwum otwierają się **niezależnie od PnL**. Przyszłość rynku jest ukryta aż do potwierdzenia wyboru.
- **Tryb:** safe room, bez aktywnego ataku MM-01 w czasie pracy z wykresem.

### M07 — Nagranie Dave'a (3:00)
- **Cel:** zdobyć nowy trop i emocjonalnie wzmocnić poszukiwania.
- **Treść:** Dave mówi o niepokojącym zastosowaniu MIRROR, przeprasza za ewentualne napięcia z bratem i wskazuje prywatny dziennik.
- **Zasada:** nagranie zostało **przygotowane przed porwaniem**; Dave nie steruje wydarzeniami z niewoli.
- **Nowa lokacja:** THE PAPER DISTRICT.

### M08 — Ucieczka / cliffhanger (2:00)
- **Obraz:** MM-01 za szkłem, częściowo ludzka twarz, ciche spojrzenie na Leona.
- **Gracz:** odnajduje przejście techniczne, ucieka z kopią dziennika; krótkie napięcie, bez nieuczciwego insta-capture.
- **Linia robocza MM-01:** „Archive breach confirmed. Subject identity pending”.
- **Efekt:** pytania o Dave'a, Kate, MIRROR i powód działań Inspektora; gracz chce zacząć rozdział 2.

**Uwaga o skali:** powyższe czasy są hipotezami. Jeżeli pierwszy level po testach jest nużący lub zbyt długi, skracamy go; nie dodajemy pustych korytarzy, by trafić w 25 minut.

# 8. MARKET REPLAY — WYMAGANIA PRODUKTOWE

**[ZATWIERDZONE]** Wyłącznie fikcyjne środki, początkowo historyczny BTC/USDT lub BTC/USD, w dalszej kolejności wybrane inne kryptowaluty i instrumenty giełdowe po weryfikacji dostępności/licencji danych. Market Replay ma być bardziej podobny do prawdziwych profesjonalnych wykresów niż stary prototyp, ale **Semi-pro Terminal**: wiarygodny i przystępny.

**Układ desktopowy:**
- pasek instrument / rynek / data / UTC / timeframe / REPLAY / wirtualne saldo;
- duży wykres z regularnymi świecami OHLC, skalą ceny, osią czasu, siatką, etykietą ostatniej ceny, kursorem z tooltipem OHLC;
- zsynchronizowany histogram wolumenu pod wykresem;
- panel LONG / SHORT / POMIŃ, nominał, ryzyko w USD i %, stop-loss, opcjonalny take-profit, szacowane opłaty i potwierdzenie;
- krokowe ujawnianie kolejnych świec, pause/step, wynik netto, koszt prowizji i omówienie decyzji, nie jedynie końcowy PnL.

**Nienaruszalne zasady uczciwości:**
1. Dane rzeczywiste mają jawne źródło, instrument, rynek, UTC, TF i status praw do komercyjnego wykorzystania; do prototypu stosujemy jawnie opisane dane syntetyczne.
2. Nie pokazujemy przyszłości w świecach, znacznikach, indikatorach, tooltipach **ani w autoskalowaniu osi** przed decyzją gracza.
3. Realistyczny model kosztów, spready/slippage i jawna konwencja przy jednoczesnym dotknięciu SL/TP w świecy bez danych tickowych.
4. SKIP to pełnoprawne rozwiązanie; fabuła nigdy nie wymaga trafnego przewidzenia ceny.
5. Ocena wyniku uwzględnia kontrolę ekspozycji, uzasadnienie, ryzyko i proces — nie sam wygrany profit.
6. Brak prawdziwych pieniędzy, realnych zleceń, kluczy giełdowych i wymuszania dźwigni.
7. Wykresy rynkowe i model faz psychologii to materiał edukacyjny, **nie gwarancja przewidywania cen**.
8. Wejścia do terminali odbywają się w bezpiecznych sekwencjach; nie w środku pościgu i nie obowiązkowo co 15 minut.

**[OTWARTE]** UX mobilny, feed i licencje danych giełdowych, czy bazowy replay wymaga ręcznego uzasadnienia transakcji, dokładna ekonomia nagród, modele spread/fee.

# 9. KAMPANIA — STRUKTURA (ROBOCZA, 6 ROZDZIAŁÓW)

1. **The Last Shift:** pierwsze wejście do archiwum, MM-01, wiadomość Dave'a, pierwsze replay. Temat: niewiara / nadzieja.
2. **The Paper District:** piękne archiwum, Kate jako okazjonalna pomoc, dziennik, tajemnicze tropy. Temat: optymizm / przekonanie.
3. **The Golden Parade:** euforia tłumu i FOMO; pojawiają się dokumenty z nazwiskiem Dave'a, chwilowe podejrzenia. Temat: euforia i nadmierna pewność siebie.
4. **The Glass Exchange:** wątpliwości wobec dokumentów i pozornych zachowań Kate; zamknięta infrastruktura MIRROR, zagrożenia. Temat: lęk / zaprzeczenie.
5. **The Drowned Vault:** potwierdzenie niewinności Dave'a, miejsce przetrzymywania, ratunek. Temat: panika / kapitulacja.
6. **The Closing Bell:** Leon i Dave współpracują, Kate pomaga mimo ryzyka dekonspiracji, zabezpieczenie dowodów, publiczne ujawnienie procederu i edukacja o rynku. Temat: zrozumienie / nowa nadzieja.

**[ZATWIERDZONE]** Bracia przeżywają. Kate ma realny wpływ na finał, nie jest dodatkiem romantycznym. Psychologia cyklu rynku jest metaforą napięcia i materiałem edukacyjnym, nie sztywnym modelem przewidującym wykres. **[ROBOCZE]** szczegółowe miejsca, zdrady pozorne, plan ujawnienia i sceny drugoplanowych Smart Money/Whale.

# 10. PRODUKCJA I WYBOR TECHNOLOGII (UPDATED, 2026-11-19)

**[ZATWIERDZONE]** Web-browser-first, later potential smartphone/iPhone, solo + AI-assisted production, minimal starting budget. Strong visual direction and smooth intuitive play are both required; test them on target browser and device.

**[NOT FROZEN]** Engine: the old greybox is Godot + GDScript (legacy project settings mention 4.6; owner has also used Godot 4.7.2). This is a real baseline, not an irrevocable engine decision. Claude Code MUST compare it against feasible web-native alternatives using explicit trade-offs. Do not switch engines without owner approval.

**[ZATWIERDZONE]** Claude Code participates as a creative peer and technical director. It should actively propose strong alternatives, challenge weak gameplay, audit old source, then implement owner-approved milestones. Previous restriction 'creative review only, no coding' is now superseded.

**Proposed production sequence:** independent web-first technology recommendation -> small visual/control performance spike in browser -> short 3-5 minute gameplay slice with Leon/MM-01/stealth/chase -> tested scene-quality improvement -> library prologue + first mission + honest replay -> rest of campaign only after verified quality gates.

**Requirements:** Playable web build with reproducible local launch, measurable load time and frame pacing, fair stealth perception, clear 2.5D camera/physics, checkpoints, no lookahead in replay, original art. Determine exact FPS/download/memory targets after measuring representative devices; do not invent pass results.

**Tech design task:** `docs/tech/WEB_FIRST_TECH_DECISION.md` and acceptance gate `docs/tech/PRODUCTION_GATE.md`.

# 11. KRYTERIA OCENY / RED FLAGS

- Gracz potrafi opisać, dlaczego Leon szuka Dave'a i dlaczego wskazówki powstały przed porwaniem.
- Gracz wyczuwa więź braci przed pierwszym thrillerowym momentem.
- Bibliotekarka jest zrozumiała i niegroźna, MM-01 budzi realny strach bez oszukiwania mechaniką.
- Po wejściu w ukrycie gracz nie zostaje magicznie wykryty przez ścianę; MM-01 zna co najwyżej ostatnią widzianą lokalizację.
- Każda zagadka ma dane umożliwiające rozwiązanie, nie wymaga klikania losowych miejsc.
- Kamera 2.5D i kolizje nie tworzą nieuczciwych porażek.
- Trading uczy ograniczania ryzyka i tolerowania braku transakcji; wyniki cen nie są układane pod fabułę.
- Każdy emocjonalny twist wynika z wcześniejszych faktów (nie z nagłej „magicznej mocy” MIRROR).
- Kate ma swoje ograniczenia i motywacje. Nie dostarcza na żądanie kluczy do wszystkiego.
- Oprawa ma oryginalną tożsamość i legalne assety.
- Drugi rozdział nie wymaga przerabiania pierwszego od zera.

# 12. PYTANIA OTWARTE (NIE BLOKUJĄ CREATIVE REVIEW)

1. Dokładne uzasadnienie przetrzymywania Dave'a żywego przez korporację; mechanizm porwania i kontrola dostępu.
2. Jak Kate bezpiecznie wysłała pierwszy kontakt „K.” i jakie ma formalne uprawnienia w korporacji?
3. Jak przygotowano i dostarczono zapis Dave'a po jego zniknięciu — z gwarancją, że nie przewidywał przyszłości?
4. Dokładna mapa i sposób przechodzenia pomiędzy płaszczyznami 2.5D w bibliotece i w The Last Shift.
5. Reprezentacja postaci w 3D, animacje, paleta i rozdzielenie dawnych, błędnie podpisanych concept artów od nowego kanonu.
6. Czy postacie Smart Money/Whale lepiej działają jako ludzie, baśniowe figury, frakcje czy tajemnicze nazwy operacji?
7. Korporacyjny legal name i granice działania PROJECT MIRROR; jak uniknąć wrażenia wszechmocy systemu?
8. Jakie pierwsze konkretne lekcje tradingowe są sprawdzalne i nie uczą nadmiernej pewności siebie?

# 13. ZASADA AKTUALIZACJI

Zmiany zgłaszaj jako **propozycje**, opisując: (1) co zmieniasz, (2) dlaczego to poprawia emocje/gameplay, (3) jaką ma cenę produkcyjną, (4) które sceny/role narusza, (5) czy wymaga zgody twórcy. Bez zgody nie zmieniaj [ZATWIERDZONE]. Aktualizacja kanonu = podniesienie wersji dokumentu i wpis w changelogu; starych plików nie kasuj po cichu.


# 14. CREATIVE REVIEW 01 -- IDEAS TO EVALUATE, NOT APPROVED CANON

Claude's review (included in `docs/reviews/CREATIVE_REVIEW_01.md`) suggested six concrete constraints on PROJECT MIRROR: aggregate behavioral prediction, blindness to disconnected archives, probabilistic error, cannot directly move markets, physical security use is secondary, and no wall-vision or mind-reading. It also proposed: (I-1) B-12 dead-man message + scheduled archive destruction + Kate urgency, (I-2) static 'Prediction' route mechanic first, (I-3) Kate in corporate compliance being watched, (I-4) Dave distancing Leon to protect him, (I-5) Godot Compatibility web-first, and reusing the childhood library during The Paper District. The creator has **not yet explicitly approved** these changes; they are candidate improvements. For the new technology decision, compare engines objectively before locking I-5.

Additional proposed quality fixes: do not treat a short 'Behavioral match 0.71' as definitive identification; avoid a simplistic 'always take the least probable route' stealth exploit; don't report probability-calibration statistics from a single market replay; confirm library geography before repeating it 15 years later.

# 15. REFERENCE GAMES -- DESIGN INSPIRATION ONLY

**Unravel Two (~80% inspiration):** atmosphere, tenderness, oversized detailed world relative to small playable characters, nature/materials/light and emotion, readable 2.5D traversal, object interaction and environmental puzzles. No transfer of exact Yarny designs, signature tether mechanics or specific original levels.

**It Takes Two (~20% inspiration):** inventive pacing, frequent mechanic variety, surprising environmental devices, occasional scripted cinematic set pieces and chases, responsive camera changes. Its co-op premise is NOT a feature requirement: all our mechanics must work for a **single** playable Leon, with Dave/Kate as rare story or NPC partners only where narratively motivated.

**Own distinct signature:** psychological predictions/observation vs choice, evocative memory of a library, a half-human corporate pursuer, the emotionally motivated brother rescue, and carefully designed optional financial market replay.
