# Beast Mode – bovenlijf trainer (PWA)

Trainingsschema met training A en B. Je vult gewicht en reps in, er is een rust-timer en de data synchroniseert via Firebase.

## 1. Firebase (eenmalig)
1. Ga naar https://console.firebase.google.com en kies **Project toevoegen**. Selecteer daarbij je organisatie. Google Analytics is niet nodig.
2. Ga naar **Build → Firestore Database → Database maken**. Kies regio `eur3 (europe-west)` en start in **productiemodus**.
3. Open het tabblad **Regels**, plak de inhoud van `firestore.rules` erin en klik op **Publiceren**.
4. Ga naar **Projectinstellingen (tandwiel) → Algemeen → Jouw apps** en voeg een web-app toe (`</>`) met de naam `beast`. Hosting is niet nodig.
5. Kopieer de waarden uit `firebaseConfig` naar `firebase-config.js`.
6. Ga naar **Authentication → Instellingen → Geautoriseerde domeinen** en voeg `<jouwnaam>.github.io` toe. De app gebruikt geen login, maar zo voorkom je problemen als je later login toevoegt.

## 2. GitHub Pages
1. Ga naar github.com, klik op **+ → New organization** en kies het gratis plan (Free). Kies een naam, bijvoorbeeld `beast-mode-training`.
2. Maak in die organisatie een **public** repo aan met de naam `<orgnaam>.github.io`, dus bijvoorbeeld `beast-mode-training.github.io`. Bij een gratis organisatie werkt Pages alleen met een publieke repo. Je GitHub Pro geldt niet voor organisaties.
3. Upload alle bestanden uit deze map, inclusief de map `icons/`.
4. Ga naar **Settings → Pages**, kies Source **Deploy from a branch**, branch `main`, map `/ (root)` en klik op **Save**.
5. Na ongeveer 1 minuut staat de app op `https://beast-mode-training.github.io/`, zonder jouw naam in de link.

## 3. Op het beginscherm zetten
- **iPhone:** open de link in **Safari**, tik op Deel en dan op **Zet op beginscherm**.
- **Android:** open de link in **Chrome**, tik op ⋮ en dan op **App installeren** of **Toevoegen aan startscherm**.

Het icoon is een rode tegel met een dumbbell en de naam onder het icoon is "Beast".

## Hoe de sync werkt
- Bij de eerste keer openen maakt de app een geheime code van 20 tekens aan. Die staat onder ⚙ Instellingen. Alle data staat in Firestore in `trainers/<code>`.
- Op een nieuwe telefoon vul je de code in bij Instellingen → Koppelen. Daarna is alles terug.
- Zonder internet werkt de app gewoon door en synchroniseert hij zodra er weer verbinding is.

## Iets aanpassen
- Oefeningen, sets, reps en rusttijden staan bovenaan in `app.js` (`EX` en `DAYS`).
- Verhoog na elke wijziging `VERSION` in `sw.js`, bijvoorbeeld naar `beast-v2`. Anders blijft de oude versie op de telefoon staan.
- Het icoon kun je aanpassen in `icons/icon.svg`.
