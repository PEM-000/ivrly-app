'use client'
// ============================================================
// app/page.tsx — VERSION 2.2
// Changes v2.2: catch 403 account_cancelled from /api/send and show a
//          friendly "Welcome back / reactivate" screen instead of the
//          raw error. Block copy hardcoded EN for now (i18n later).
// Changes v2.1: validate guest phone to E.164 (libphonenumber-js)
//          before send; invalid numbers show the translated
//          country-code hint instead of failing at Twilio.
// Changes v2.0: Full owner UI i18n. Detects owner language
//          from public.users.default_language, falls back to
//          browser language, then English. All Send screen
//          labels, buttons, errors and messages translated
//          into 18 languages.
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { parsePhoneNumberFromString } from 'libphonenumber-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── UI Translations ───────────────────────────────────────────────────────────

const UI_STRINGS = {
  en: {
    messageType: 'Message type',
    roomShowcase: 'Room Showcase',
    selfCheckin: 'Self Check-In',
    property: 'Property',
    room: 'Room',
    language: 'Language',
    deliveryMethod: 'Delivery method',
    sms: 'SMS',
    emailFree: 'Email — free',
    guestPhone: 'Guest phone number',
    phoneHint: 'Include country code — e.g. +1 US, +44 UK, +48 Poland',
    lookingUpRate: 'Looking up rate…',
    perMessage: 'per message',
    sendFreeEmail: 'Send free via email instead',
    guestEmail: 'Guest email address',
    emailFreeNote: 'Email delivery is always free — no SMS charges apply.',
    reasonForSending: 'Reason for sending',
    guestRequested: 'Guest requested this message',
    guestRequestedDesc: 'The guest contacted the property and specifically asked to receive this information.',
    noRooms: 'No rooms found.',
    sendAnother: 'Send another →',
    sendViaEmail: 'Send via email →',
    sendViaSms: 'Send via SMS →',
    sending: 'Sending…',
    signOut: 'Sign out',
    cancel: 'Cancel',
    sent: 'Sent!',
    guestLinkDelivered: 'Guest link delivered to',
    signOutTitle: 'Sign out?',
    signOutDesc: "You'll need your phone number to sign back in — we'll send you a 6-digit code.",
    enterRateHint: 'Enter full number with country code to see rate',
    selectProperty: 'Select a property.',
    selectRoom: 'Select a room.',
    confirmConsent: 'Please confirm the guest requested this message.',
    enterPhone: 'Enter a phone number.',
    enterEmail: 'Enter an email address.',
    somethingWrong: 'Something went wrong.',
    smsTo: 'SMS to',
  },
  pl: {
    messageType: 'Typ wiadomości',
    roomShowcase: 'Prezentacja pokoju',
    selfCheckin: 'Samodzielne zameldowanie',
    property: 'Obiekt',
    room: 'Pokój',
    language: 'Język',
    deliveryMethod: 'Sposób dostarczenia',
    sms: 'SMS',
    emailFree: 'E-mail — bezpłatnie',
    guestPhone: 'Telefon gościa',
    phoneHint: 'Podaj kod kraju, np. +1 USA, +44 UK, +48 Polska',
    lookingUpRate: 'Sprawdzanie stawki…',
    perMessage: 'za wiadomość',
    sendFreeEmail: 'Wyślij bezpłatnie e-mailem',
    guestEmail: 'E-mail gościa',
    emailFreeNote: 'Wysyłka e-mailem jest zawsze bezpłatna.',
    reasonForSending: 'Powód wysłania',
    guestRequested: 'Gość prosił o tę wiadomość',
    guestRequestedDesc: 'Gość skontaktował się z obiektem i poprosił o te informacje.',
    noRooms: 'Brak pokoi.',
    sendAnother: 'Wyślij kolejną →',
    sendViaEmail: 'Wyślij e-mailem →',
    sendViaSms: 'Wyślij SMS →',
    sending: 'Wysyłanie…',
    signOut: 'Wyloguj',
    cancel: 'Anuluj',
    sent: 'Wysłano!',
    guestLinkDelivered: 'Link gościa wysłany do',
    signOutTitle: 'Wylogować się?',
    signOutDesc: 'Do ponownego logowania potrzebny będzie numer telefonu — wyślemy 6-cyfrowy kod.',
    enterRateHint: 'Podaj pełny numer z kodem kraju, aby zobaczyć stawkę',
    selectProperty: 'Wybierz obiekt.',
    selectRoom: 'Wybierz pokój.',
    confirmConsent: 'Potwierdź, że gość prosił o tę wiadomość.',
    enterPhone: 'Podaj numer telefonu.',
    enterEmail: 'Podaj adres e-mail.',
    somethingWrong: 'Coś poszło nie tak.',
    smsTo: 'SMS do',
  },
  de: {
    messageType: 'Nachrichtentyp',
    roomShowcase: 'Zimmervorschau',
    selfCheckin: 'Selbst-Check-in',
    property: 'Unterkunft',
    room: 'Zimmer',
    language: 'Sprache',
    deliveryMethod: 'Versandmethode',
    sms: 'SMS',
    emailFree: 'E-Mail — kostenlos',
    guestPhone: 'Telefon des Gastes',
    phoneHint: 'Ländervorwahl angeben, z.B. +1 USA, +44 UK, +49 Deutschland',
    lookingUpRate: 'Tarif wird gesucht…',
    perMessage: 'pro Nachricht',
    sendFreeEmail: 'Kostenlos per E-Mail senden',
    guestEmail: 'E-Mail-Adresse des Gastes',
    emailFreeNote: 'E-Mail-Versand ist immer kostenlos.',
    reasonForSending: 'Grund für die Sendung',
    guestRequested: 'Gast hat diese Nachricht angefordert',
    guestRequestedDesc: 'Der Gast hat die Unterkunft kontaktiert und um diese Informationen gebeten.',
    noRooms: 'Keine Zimmer gefunden.',
    sendAnother: 'Weitere senden →',
    sendViaEmail: 'Per E-Mail senden →',
    sendViaSms: 'Per SMS senden →',
    sending: 'Wird gesendet…',
    signOut: 'Abmelden',
    cancel: 'Abbrechen',
    sent: 'Gesendet!',
    guestLinkDelivered: 'Gast-Link gesendet an',
    signOutTitle: 'Abmelden?',
    signOutDesc: 'Zum erneuten Anmelden wird Ihre Telefonnummer benötigt — wir senden einen 6-stelligen Code.',
    enterRateHint: 'Vollständige Nummer mit Ländervorwahl eingeben',
    selectProperty: 'Unterkunft auswählen.',
    selectRoom: 'Zimmer auswählen.',
    confirmConsent: 'Bitte bestätigen Sie, dass der Gast diese Nachricht angefordert hat.',
    enterPhone: 'Telefonnummer eingeben.',
    enterEmail: 'E-Mail-Adresse eingeben.',
    somethingWrong: 'Etwas ist schiefgelaufen.',
    smsTo: 'SMS nach',
  },
  fr: {
    messageType: 'Type de message',
    roomShowcase: 'Présentation de la chambre',
    selfCheckin: 'Enregistrement autonome',
    property: 'Établissement',
    room: 'Chambre',
    language: 'Langue',
    deliveryMethod: "Mode d'envoi",
    sms: 'SMS',
    emailFree: 'E-mail — gratuit',
    guestPhone: 'Téléphone du client',
    phoneHint: "Incluez l'indicatif pays, ex. +1 USA, +44 UK, +33 France",
    lookingUpRate: 'Recherche du tarif…',
    perMessage: 'par message',
    sendFreeEmail: 'Envoyer gratuitement par e-mail',
    guestEmail: 'E-mail du client',
    emailFreeNote: "L'envoi par e-mail est toujours gratuit.",
    reasonForSending: "Raison d'envoi",
    guestRequested: 'Le client a demandé ce message',
    guestRequestedDesc: "Le client a contacté l'établissement et a spécifiquement demandé à recevoir ces informations.",
    noRooms: 'Aucune chambre trouvée.',
    sendAnother: 'Envoyer un autre →',
    sendViaEmail: 'Envoyer par e-mail →',
    sendViaSms: 'Envoyer par SMS →',
    sending: 'Envoi en cours…',
    signOut: 'Déconnexion',
    cancel: 'Annuler',
    sent: 'Envoyé !',
    guestLinkDelivered: 'Lien client envoyé à',
    signOutTitle: 'Se déconnecter ?',
    signOutDesc: "Vous aurez besoin de votre numéro de téléphone pour vous reconnecter — nous enverrons un code à 6 chiffres.",
    enterRateHint: "Entrez le numéro complet avec l'indicatif pays",
    selectProperty: 'Sélectionnez un établissement.',
    selectRoom: 'Sélectionnez une chambre.',
    confirmConsent: 'Veuillez confirmer que le client a demandé ce message.',
    enterPhone: 'Entrez un numéro de téléphone.',
    enterEmail: 'Entrez une adresse e-mail.',
    somethingWrong: 'Une erreur s\'est produite.',
    smsTo: 'SMS vers',
  },
  it: {
    messageType: 'Tipo di messaggio',
    roomShowcase: 'Presentazione della camera',
    selfCheckin: 'Check-in autonomo',
    property: 'Struttura',
    room: 'Camera',
    language: 'Lingua',
    deliveryMethod: 'Metodo di invio',
    sms: 'SMS',
    emailFree: 'Email — gratuita',
    guestPhone: "Telefono dell'ospite",
    phoneHint: 'Includi il prefisso internazionale, es. +1 USA, +44 UK, +39 Italia',
    lookingUpRate: 'Ricerca tariffa…',
    perMessage: 'per messaggio',
    sendFreeEmail: 'Invia gratuitamente via email',
    guestEmail: "Email dell'ospite",
    emailFreeNote: "L'invio via email è sempre gratuito.",
    reasonForSending: "Motivo dell'invio",
    guestRequested: "L'ospite ha richiesto questo messaggio",
    guestRequestedDesc: "L'ospite ha contattato la struttura e ha specificatamente richiesto di ricevere queste informazioni.",
    noRooms: 'Nessuna camera trovata.',
    sendAnother: 'Invia un altro →',
    sendViaEmail: 'Invia via email →',
    sendViaSms: 'Invia via SMS →',
    sending: 'Invio in corso…',
    signOut: 'Esci',
    cancel: 'Annulla',
    sent: 'Inviato!',
    guestLinkDelivered: 'Link ospite inviato a',
    signOutTitle: 'Uscire?',
    signOutDesc: 'Per accedere di nuovo sarà necessario il numero di telefono — invieremo un codice a 6 cifre.',
    enterRateHint: 'Inserisci il numero completo con il prefisso internazionale',
    selectProperty: 'Seleziona una struttura.',
    selectRoom: 'Seleziona una camera.',
    confirmConsent: "Conferma che l'ospite ha richiesto questo messaggio.",
    enterPhone: 'Inserisci un numero di telefono.',
    enterEmail: 'Inserisci un indirizzo email.',
    somethingWrong: 'Qualcosa è andato storto.',
    smsTo: 'SMS a',
  },
  es: {
    messageType: 'Tipo de mensaje',
    roomShowcase: 'Presentación de la habitación',
    selfCheckin: 'Check-in autónomo',
    property: 'Alojamiento',
    room: 'Habitación',
    language: 'Idioma',
    deliveryMethod: 'Método de envío',
    sms: 'SMS',
    emailFree: 'Correo — gratis',
    guestPhone: 'Teléfono del huésped',
    phoneHint: 'Incluye el código de país, ej. +1 EE.UU., +44 UK, +34 España',
    lookingUpRate: 'Buscando tarifa…',
    perMessage: 'por mensaje',
    sendFreeEmail: 'Enviar gratis por correo',
    guestEmail: 'Correo del huésped',
    emailFreeNote: 'El envío por correo es siempre gratuito.',
    reasonForSending: 'Motivo del envío',
    guestRequested: 'El huésped solicitó este mensaje',
    guestRequestedDesc: 'El huésped contactó con el alojamiento y pidió específicamente recibir esta información.',
    noRooms: 'No se encontraron habitaciones.',
    sendAnother: 'Enviar otro →',
    sendViaEmail: 'Enviar por correo →',
    sendViaSms: 'Enviar por SMS →',
    sending: 'Enviando…',
    signOut: 'Cerrar sesión',
    cancel: 'Cancelar',
    sent: '¡Enviado!',
    guestLinkDelivered: 'Enlace del huésped enviado a',
    signOutTitle: '¿Cerrar sesión?',
    signOutDesc: 'Necesitarás tu número de teléfono para volver a iniciar sesión — te enviaremos un código de 6 dígitos.',
    enterRateHint: 'Introduce el número completo con el código de país',
    selectProperty: 'Selecciona un alojamiento.',
    selectRoom: 'Selecciona una habitación.',
    confirmConsent: 'Confirma que el huésped solicitó este mensaje.',
    enterPhone: 'Introduce un número de teléfono.',
    enterEmail: 'Introduce una dirección de correo.',
    somethingWrong: 'Algo salió mal.',
    smsTo: 'SMS a',
  },
  pt: {
    messageType: 'Tipo de mensagem',
    roomShowcase: 'Apresentação do quarto',
    selfCheckin: 'Auto check-in',
    property: 'Propriedade',
    room: 'Quarto',
    language: 'Idioma',
    deliveryMethod: 'Método de envio',
    sms: 'SMS',
    emailFree: 'Email — grátis',
    guestPhone: 'Telefone do hóspede',
    phoneHint: 'Inclua o indicativo do país, ex. +1 EUA, +44 UK, +351 Portugal',
    lookingUpRate: 'A verificar tarifa…',
    perMessage: 'por mensagem',
    sendFreeEmail: 'Enviar gratuitamente por email',
    guestEmail: 'Email do hóspede',
    emailFreeNote: 'O envio por email é sempre gratuito.',
    reasonForSending: 'Motivo do envio',
    guestRequested: 'O hóspede solicitou esta mensagem',
    guestRequestedDesc: 'O hóspede contactou a propriedade e pediu especificamente para receber estas informações.',
    noRooms: 'Nenhum quarto encontrado.',
    sendAnother: 'Enviar outro →',
    sendViaEmail: 'Enviar por email →',
    sendViaSms: 'Enviar por SMS →',
    sending: 'A enviar…',
    signOut: 'Sair',
    cancel: 'Cancelar',
    sent: 'Enviado!',
    guestLinkDelivered: 'Link do hóspede enviado para',
    signOutTitle: 'Sair?',
    signOutDesc: 'Precisará do seu número de telefone para voltar a iniciar sessão — enviaremos um código de 6 dígitos.',
    enterRateHint: 'Introduza o número completo com indicativo do país',
    selectProperty: 'Selecione uma propriedade.',
    selectRoom: 'Selecione um quarto.',
    confirmConsent: 'Confirme que o hóspede solicitou esta mensagem.',
    enterPhone: 'Introduza um número de telefone.',
    enterEmail: 'Introduza um endereço de email.',
    somethingWrong: 'Algo correu mal.',
    smsTo: 'SMS para',
  },
  nl: {
    messageType: 'Berichttype',
    roomShowcase: 'Kamerpresentatie',
    selfCheckin: 'Zelf inchecken',
    property: 'Accommodatie',
    room: 'Kamer',
    language: 'Taal',
    deliveryMethod: 'Verzendmethode',
    sms: 'SMS',
    emailFree: 'E-mail — gratis',
    guestPhone: 'Telefoonnummer gast',
    phoneHint: 'Landcode opgeven, bijv. +1 VS, +44 UK, +31 Nederland',
    lookingUpRate: 'Tarief opzoeken…',
    perMessage: 'per bericht',
    sendFreeEmail: 'Gratis verzenden via e-mail',
    guestEmail: 'E-mailadres gast',
    emailFreeNote: 'E-mailverzending is altijd gratis.',
    reasonForSending: 'Reden voor verzending',
    guestRequested: 'Gast heeft dit bericht aangevraagd',
    guestRequestedDesc: 'De gast heeft de accommodatie gecontacteerd en specifiek gevraagd om deze informatie te ontvangen.',
    noRooms: 'Geen kamers gevonden.',
    sendAnother: 'Nog een verzenden →',
    sendViaEmail: 'Verzenden via e-mail →',
    sendViaSms: 'Verzenden via SMS →',
    sending: 'Verzenden…',
    signOut: 'Uitloggen',
    cancel: 'Annuleren',
    sent: 'Verzonden!',
    guestLinkDelivered: 'Gastlink verzonden naar',
    signOutTitle: 'Uitloggen?',
    signOutDesc: 'U heeft uw telefoonnummer nodig om opnieuw in te loggen — we sturen een 6-cijferige code.',
    enterRateHint: 'Volledig nummer met landcode invoeren',
    selectProperty: 'Selecteer een accommodatie.',
    selectRoom: 'Selecteer een kamer.',
    confirmConsent: 'Bevestig dat de gast dit bericht heeft aangevraagd.',
    enterPhone: 'Voer een telefoonnummer in.',
    enterEmail: 'Voer een e-mailadres in.',
    somethingWrong: 'Er is iets misgegaan.',
    smsTo: 'SMS naar',
  },
  cs: {
    messageType: 'Typ zprávy',
    roomShowcase: 'Prezentace pokoje',
    selfCheckin: 'Samostatné přihlášení',
    property: 'Ubytování',
    room: 'Pokoj',
    language: 'Jazyk',
    deliveryMethod: 'Způsob doručení',
    sms: 'SMS',
    emailFree: 'E-mail — zdarma',
    guestPhone: 'Telefon hosta',
    phoneHint: 'Uveďte kód země, např. +1 USA, +44 UK, +420 ČR',
    lookingUpRate: 'Hledání tarifu…',
    perMessage: 'za zprávu',
    sendFreeEmail: 'Odeslat zdarma e-mailem',
    guestEmail: 'E-mail hosta',
    emailFreeNote: 'Doručení e-mailem je vždy zdarma.',
    reasonForSending: 'Důvod odeslání',
    guestRequested: 'Host požádal o tuto zprávu',
    guestRequestedDesc: 'Host kontaktoval ubytování a konkrétně požádal o obdržení těchto informací.',
    noRooms: 'Žádné pokoje nenalezeny.',
    sendAnother: 'Odeslat další →',
    sendViaEmail: 'Odeslat e-mailem →',
    sendViaSms: 'Odeslat SMS →',
    sending: 'Odesílání…',
    signOut: 'Odhlásit',
    cancel: 'Zrušit',
    sent: 'Odesláno!',
    guestLinkDelivered: 'Odkaz hosta odeslán na',
    signOutTitle: 'Odhlásit se?',
    signOutDesc: 'K opětovnému přihlášení budete potřebovat telefonní číslo — zašleme 6místný kód.',
    enterRateHint: 'Zadejte celé číslo s kódem země',
    selectProperty: 'Vyberte ubytování.',
    selectRoom: 'Vyberte pokoj.',
    confirmConsent: 'Potvrďte, že host požádal o tuto zprávu.',
    enterPhone: 'Zadejte telefonní číslo.',
    enterEmail: 'Zadejte e-mailovou adresu.',
    somethingWrong: 'Něco se pokazilo.',
    smsTo: 'SMS do',
  },
  sk: {
    messageType: 'Typ správy',
    roomShowcase: 'Prezentácia izby',
    selfCheckin: 'Samostatné prihlásenie',
    property: 'Ubytovanie',
    room: 'Izba',
    language: 'Jazyk',
    deliveryMethod: 'Spôsob doručenia',
    sms: 'SMS',
    emailFree: 'E-mail — zadarmo',
    guestPhone: 'Telefón hosťa',
    phoneHint: 'Uveďte kód krajiny, napr. +1 USA, +44 UK, +421 SR',
    lookingUpRate: 'Hľadanie tarify…',
    perMessage: 'za správu',
    sendFreeEmail: 'Odoslať zadarmo e-mailom',
    guestEmail: 'E-mail hosťa',
    emailFreeNote: 'Doručenie e-mailom je vždy zadarmo.',
    reasonForSending: 'Dôvod odoslania',
    guestRequested: 'Hosť požiadal o túto správu',
    guestRequestedDesc: 'Hosť kontaktoval ubytovanie a konkrétne požiadal o tieto informácie.',
    noRooms: 'Žiadne izby nenájdené.',
    sendAnother: 'Odoslať ďalšiu →',
    sendViaEmail: 'Odoslať e-mailom →',
    sendViaSms: 'Odoslať SMS →',
    sending: 'Odosielanie…',
    signOut: 'Odhlásiť',
    cancel: 'Zrušiť',
    sent: 'Odoslané!',
    guestLinkDelivered: 'Odkaz hosťa odoslaný na',
    signOutTitle: 'Odhlásiť sa?',
    signOutDesc: 'Na opätovné prihlásenie budete potrebovať telefónne číslo — zašleme 6-miestny kód.',
    enterRateHint: 'Zadajte celé číslo s kódom krajiny',
    selectProperty: 'Vyberte ubytovanie.',
    selectRoom: 'Vyberte izbu.',
    confirmConsent: 'Potvrďte, že hosť požiadal o túto správu.',
    enterPhone: 'Zadajte telefónne číslo.',
    enterEmail: 'Zadajte e-mailovú adresu.',
    somethingWrong: 'Niečo sa pokazilo.',
    smsTo: 'SMS do',
  },
  hu: {
    messageType: 'Üzenet típusa',
    roomShowcase: 'Szobabemutató',
    selfCheckin: 'Önálló bejelentkezés',
    property: 'Szálláshely',
    room: 'Szoba',
    language: 'Nyelv',
    deliveryMethod: 'Küldési mód',
    sms: 'SMS',
    emailFree: 'E-mail — ingyenes',
    guestPhone: 'Vendég telefonszáma',
    phoneHint: 'Adja meg az országkódot, pl. +1 USA, +44 UK, +36 Magyarország',
    lookingUpRate: 'Díjszabás keresése…',
    perMessage: 'üzenetenként',
    sendFreeEmail: 'Ingyenes küldés e-mailben',
    guestEmail: 'Vendég e-mail címe',
    emailFreeNote: 'Az e-mailes küldés mindig ingyenes.',
    reasonForSending: 'Küldés oka',
    guestRequested: 'A vendég kérte ezt az üzenetet',
    guestRequestedDesc: 'A vendég kapcsolatba lépett a szálláshellyel és kifejezetten kérte ezen információk megküldését.',
    noRooms: 'Nem található szoba.',
    sendAnother: 'Másik küldése →',
    sendViaEmail: 'Küldés e-mailben →',
    sendViaSms: 'Küldés SMS-ben →',
    sending: 'Küldés…',
    signOut: 'Kijelentkezés',
    cancel: 'Mégse',
    sent: 'Elküldve!',
    guestLinkDelivered: 'Vendég link elküldve ide:',
    signOutTitle: 'Kijelentkezés?',
    signOutDesc: 'A visszalépéshez szükség lesz a telefonszámára — 6 jegyű kódot küldünk.',
    enterRateHint: 'Adja meg a teljes számot az országkóddal',
    selectProperty: 'Válasszon szálláshelyet.',
    selectRoom: 'Válasszon szobát.',
    confirmConsent: 'Erősítse meg, hogy a vendég kérte ezt az üzenetet.',
    enterPhone: 'Adjon meg egy telefonszámot.',
    enterEmail: 'Adjon meg egy e-mail címet.',
    somethingWrong: 'Valami hiba történt.',
    smsTo: 'SMS ide:',
  },
  ro: {
    messageType: 'Tip mesaj',
    roomShowcase: 'Prezentare cameră',
    selfCheckin: 'Check-in autonom',
    property: 'Proprietate',
    room: 'Cameră',
    language: 'Limbă',
    deliveryMethod: 'Metodă de trimitere',
    sms: 'SMS',
    emailFree: 'Email — gratuit',
    guestPhone: 'Telefon oaspete',
    phoneHint: 'Includeți prefixul internațional, ex. +1 SUA, +44 UK, +40 România',
    lookingUpRate: 'Căutare tarif…',
    perMessage: 'per mesaj',
    sendFreeEmail: 'Trimite gratuit prin email',
    guestEmail: 'Email oaspete',
    emailFreeNote: 'Trimiterea prin email este întotdeauna gratuită.',
    reasonForSending: 'Motiv trimitere',
    guestRequested: 'Oaspetele a solicitat acest mesaj',
    guestRequestedDesc: 'Oaspetele a contactat proprietatea și a solicitat în mod specific aceste informații.',
    noRooms: 'Nu s-au găsit camere.',
    sendAnother: 'Trimite altul →',
    sendViaEmail: 'Trimite prin email →',
    sendViaSms: 'Trimite prin SMS →',
    sending: 'Se trimite…',
    signOut: 'Deconectare',
    cancel: 'Anulare',
    sent: 'Trimis!',
    guestLinkDelivered: 'Link oaspete trimis la',
    signOutTitle: 'Deconectare?',
    signOutDesc: 'Veți avea nevoie de numărul de telefon pentru a vă reconecta — vom trimite un cod de 6 cifre.',
    enterRateHint: 'Introduceți numărul complet cu prefix internațional',
    selectProperty: 'Selectați o proprietate.',
    selectRoom: 'Selectați o cameră.',
    confirmConsent: 'Confirmați că oaspetele a solicitat acest mesaj.',
    enterPhone: 'Introduceți un număr de telefon.',
    enterEmail: 'Introduceți o adresă de email.',
    somethingWrong: 'Ceva a mers greșit.',
    smsTo: 'SMS către',
  },
  sv: {
    messageType: 'Meddelandetyp',
    roomShowcase: 'Rumsvisning',
    selfCheckin: 'Självincheckning',
    property: 'Boende',
    room: 'Rum',
    language: 'Språk',
    deliveryMethod: 'Leveranssätt',
    sms: 'SMS',
    emailFree: 'E-post — gratis',
    guestPhone: 'Gästens telefonnummer',
    phoneHint: 'Ange landskod, t.ex. +1 USA, +44 UK, +46 Sverige',
    lookingUpRate: 'Söker taxa…',
    perMessage: 'per meddelande',
    sendFreeEmail: 'Skicka gratis via e-post',
    guestEmail: 'Gästens e-postadress',
    emailFreeNote: 'E-postleverans är alltid gratis.',
    reasonForSending: 'Anledning till utskick',
    guestRequested: 'Gästen begärde detta meddelande',
    guestRequestedDesc: 'Gästen kontaktade boendet och bad specifikt om att få denna information.',
    noRooms: 'Inga rum hittades.',
    sendAnother: 'Skicka en till →',
    sendViaEmail: 'Skicka via e-post →',
    sendViaSms: 'Skicka via SMS →',
    sending: 'Skickar…',
    signOut: 'Logga ut',
    cancel: 'Avbryt',
    sent: 'Skickat!',
    guestLinkDelivered: 'Gästlänk skickad till',
    signOutTitle: 'Logga ut?',
    signOutDesc: 'Du behöver ditt telefonnummer för att logga in igen — vi skickar en 6-siffrig kod.',
    enterRateHint: 'Ange fullständigt nummer med landskod',
    selectProperty: 'Välj ett boende.',
    selectRoom: 'Välj ett rum.',
    confirmConsent: 'Bekräfta att gästen begärde detta meddelande.',
    enterPhone: 'Ange ett telefonnummer.',
    enterEmail: 'Ange en e-postadress.',
    somethingWrong: 'Något gick fel.',
    smsTo: 'SMS till',
  },
  da: {
    messageType: 'Beskedtype',
    roomShowcase: 'Værelsesvisning',
    selfCheckin: 'Selvbetjent check-in',
    property: 'Overnatning',
    room: 'Værelse',
    language: 'Sprog',
    deliveryMethod: 'Leveringsmetode',
    sms: 'SMS',
    emailFree: 'E-mail — gratis',
    guestPhone: 'Gæstens telefonnummer',
    phoneHint: 'Angiv landekode, f.eks. +1 USA, +44 UK, +45 Danmark',
    lookingUpRate: 'Søger takst…',
    perMessage: 'pr. besked',
    sendFreeEmail: 'Send gratis via e-mail',
    guestEmail: 'Gæstens e-mailadresse',
    emailFreeNote: 'E-maillevering er altid gratis.',
    reasonForSending: 'Årsag til afsendelse',
    guestRequested: 'Gæsten anmodede om denne besked',
    guestRequestedDesc: 'Gæsten kontaktede overnatningsstedet og bad specifikt om at modtage disse oplysninger.',
    noRooms: 'Ingen værelser fundet.',
    sendAnother: 'Send endnu en →',
    sendViaEmail: 'Send via e-mail →',
    sendViaSms: 'Send via SMS →',
    sending: 'Sender…',
    signOut: 'Log ud',
    cancel: 'Annuller',
    sent: 'Sendt!',
    guestLinkDelivered: 'Gæstelink sendt til',
    signOutTitle: 'Log ud?',
    signOutDesc: 'Du skal bruge dit telefonnummer for at logge ind igen — vi sender en 6-cifret kode.',
    enterRateHint: 'Indtast det fulde nummer med landekode',
    selectProperty: 'Vælg en overnatning.',
    selectRoom: 'Vælg et værelse.',
    confirmConsent: 'Bekræft at gæsten anmodede om denne besked.',
    enterPhone: 'Indtast et telefonnummer.',
    enterEmail: 'Indtast en e-mailadresse.',
    somethingWrong: 'Noget gik galt.',
    smsTo: 'SMS til',
  },
  fi: {
    messageType: 'Viestityyppi',
    roomShowcase: 'Huone-esittely',
    selfCheckin: 'Omatoiminen sisäänkirjautuminen',
    property: 'Majoitus',
    room: 'Huone',
    language: 'Kieli',
    deliveryMethod: 'Toimitustapa',
    sms: 'SMS',
    emailFree: 'Sähköposti — ilmainen',
    guestPhone: 'Vieraan puhelinnumero',
    phoneHint: 'Lisää maakoodi, esim. +1 USA, +44 UK, +358 Suomi',
    lookingUpRate: 'Haetaan hintaa…',
    perMessage: 'per viesti',
    sendFreeEmail: 'Lähetä ilmaiseksi sähköpostilla',
    guestEmail: 'Vieraan sähköpostiosoite',
    emailFreeNote: 'Sähköpostilähetys on aina ilmainen.',
    reasonForSending: 'Lähetyksen syy',
    guestRequested: 'Vieras pyysi tätä viestiä',
    guestRequestedDesc: 'Vieras otti yhteyttä majoitukseen ja pyysi nimenomaisesti näitä tietoja.',
    noRooms: 'Huoneita ei löydy.',
    sendAnother: 'Lähetä toinen →',
    sendViaEmail: 'Lähetä sähköpostilla →',
    sendViaSms: 'Lähetä tekstiviestillä →',
    sending: 'Lähetetään…',
    signOut: 'Kirjaudu ulos',
    cancel: 'Peruuta',
    sent: 'Lähetetty!',
    guestLinkDelivered: 'Vieraslinkki lähetetty osoitteeseen',
    signOutTitle: 'Kirjaudu ulos?',
    signOutDesc: 'Tarvitset puhelinnumerosi kirjautuaksesi uudelleen — lähetämme 6-numeroisen koodin.',
    enterRateHint: 'Anna koko numero maakoodilla',
    selectProperty: 'Valitse majoitus.',
    selectRoom: 'Valitse huone.',
    confirmConsent: 'Vahvista, että vieras pyysi tätä viestiä.',
    enterPhone: 'Anna puhelinnumero.',
    enterEmail: 'Anna sähköpostiosoite.',
    somethingWrong: 'Jotain meni pieleen.',
    smsTo: 'SMS osoitteeseen',
  },
  nb: {
    messageType: 'Meldingstype',
    roomShowcase: 'Romsvisning',
    selfCheckin: 'Selvbetjent innsjekking',
    property: 'Overnatting',
    room: 'Rom',
    language: 'Språk',
    deliveryMethod: 'Leveringsmetode',
    sms: 'SMS',
    emailFree: 'E-post — gratis',
    guestPhone: 'Gjestens telefonnummer',
    phoneHint: 'Angi landskode, f.eks. +1 USA, +44 UK, +47 Norge',
    lookingUpRate: 'Søker etter takst…',
    perMessage: 'per melding',
    sendFreeEmail: 'Send gratis via e-post',
    guestEmail: 'Gjestens e-postadresse',
    emailFreeNote: 'E-postlevering er alltid gratis.',
    reasonForSending: 'Årsak til sending',
    guestRequested: 'Gjesten ba om denne meldingen',
    guestRequestedDesc: 'Gjesten kontaktet overnattingsstedet og ba spesifikt om å motta denne informasjonen.',
    noRooms: 'Ingen rom funnet.',
    sendAnother: 'Send en til →',
    sendViaEmail: 'Send via e-post →',
    sendViaSms: 'Send via SMS →',
    sending: 'Sender…',
    signOut: 'Logg ut',
    cancel: 'Avbryt',
    sent: 'Sendt!',
    guestLinkDelivered: 'Gjestelenke sendt til',
    signOutTitle: 'Logg ut?',
    signOutDesc: 'Du trenger telefonnummeret ditt for å logge inn igjen — vi sender en 6-sifret kode.',
    enterRateHint: 'Skriv inn fullt nummer med landskode',
    selectProperty: 'Velg en overnatting.',
    selectRoom: 'Velg et rom.',
    confirmConsent: 'Bekreft at gjesten ba om denne meldingen.',
    enterPhone: 'Skriv inn et telefonnummer.',
    enterEmail: 'Skriv inn en e-postadresse.',
    somethingWrong: 'Noe gikk galt.',
    smsTo: 'SMS til',
  },
  ru: {
    messageType: 'Тип сообщения',
    roomShowcase: 'Презентация номера',
    selfCheckin: 'Самостоятельное заселение',
    property: 'Объект',
    room: 'Номер',
    language: 'Язык',
    deliveryMethod: 'Способ отправки',
    sms: 'SMS',
    emailFree: 'Email — бесплатно',
    guestPhone: 'Телефон гостя',
    phoneHint: 'Укажите код страны, напр. +1 США, +44 UK, +7 Россия',
    lookingUpRate: 'Поиск тарифа…',
    perMessage: 'за сообщение',
    sendFreeEmail: 'Отправить бесплатно по email',
    guestEmail: 'Email гостя',
    emailFreeNote: 'Отправка по email всегда бесплатна.',
    reasonForSending: 'Причина отправки',
    guestRequested: 'Гость запросил это сообщение',
    guestRequestedDesc: 'Гость обратился к объекту размещения с просьбой получить эту информацию.',
    noRooms: 'Номера не найдены.',
    sendAnother: 'Отправить ещё →',
    sendViaEmail: 'Отправить по email →',
    sendViaSms: 'Отправить по SMS →',
    sending: 'Отправка…',
    signOut: 'Выйти',
    cancel: 'Отмена',
    sent: 'Отправлено!',
    guestLinkDelivered: 'Ссылка для гостя отправлена на',
    signOutTitle: 'Выйти из системы?',
    signOutDesc: 'Для повторного входа потребуется номер телефона — мы отправим 6-значный код.',
    enterRateHint: 'Введите полный номер с кодом страны',
    selectProperty: 'Выберите объект.',
    selectRoom: 'Выберите номер.',
    confirmConsent: 'Подтвердите, что гость запросил это сообщение.',
    enterPhone: 'Введите номер телефона.',
    enterEmail: 'Введите адрес email.',
    somethingWrong: 'Что-то пошло не так.',
    smsTo: 'SMS в',
  },
  uk: {
    messageType: 'Тип повідомлення',
    roomShowcase: 'Презентація номера',
    selfCheckin: 'Самостійне заселення',
    property: "Об'єкт",
    room: 'Номер',
    language: 'Мова',
    deliveryMethod: 'Спосіб надсилання',
    sms: 'SMS',
    emailFree: 'Email — безкоштовно',
    guestPhone: 'Телефон гостя',
    phoneHint: 'Вкажіть код країни, напр. +1 США, +44 UK, +380 Україна',
    lookingUpRate: 'Пошук тарифу…',
    perMessage: 'за повідомлення',
    sendFreeEmail: 'Надіслати безкоштовно по email',
    guestEmail: 'Email гостя',
    emailFreeNote: 'Надсилання по email завжди безкоштовне.',
    reasonForSending: 'Причина надсилання',
    guestRequested: 'Гість запросив це повідомлення',
    guestRequestedDesc: "Гість звернувся до об'єкту розміщення з проханням отримати цю інформацію.",
    noRooms: 'Номери не знайдено.',
    sendAnother: 'Надіслати ще →',
    sendViaEmail: 'Надіслати по email →',
    sendViaSms: 'Надіслати по SMS →',
    sending: 'Надсилання…',
    signOut: 'Вийти',
    cancel: 'Скасувати',
    sent: 'Надіслано!',
    guestLinkDelivered: 'Посилання для гостя надіслано на',
    signOutTitle: 'Вийти з системи?',
    signOutDesc: 'Для повторного входу знадобиться номер телефону — ми надішлемо 6-значний код.',
    enterRateHint: 'Введіть повний номер з кодом країни',
    selectProperty: "Виберіть об'єкт.",
    selectRoom: 'Виберіть номер.',
    confirmConsent: 'Підтвердьте, що гість запросив це повідомлення.',
    enterPhone: 'Введіть номер телефону.',
    enterEmail: 'Введіть адресу email.',
    somethingWrong: 'Щось пішло не так.',
    smsTo: 'SMS до',
  },
}

type LangKey = keyof typeof UI_STRINGS
type StringKey = keyof typeof UI_STRINGS['en']

const SUPPORTED_LANGS = Object.keys(UI_STRINGS) as LangKey[]

// ── Data types ────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'pl', label: 'Polish' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'it', label: 'Italian' },
  { code: 'es', label: 'Spanish' },
  { code: 'ru', label: 'Russian' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'cs', label: 'Czech' },
  { code: 'sk', label: 'Slovak' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ro', label: 'Romanian' },
  { code: 'hu', label: 'Hungarian' },
  { code: 'sv', label: 'Swedish' },
  { code: 'da', label: 'Danish' },
  { code: 'fi', label: 'Finnish' },
  { code: 'nb', label: 'Norwegian' },
]

type Property = { id: string; name: string; primary_language: string | null }
type Room = { id: string; internal_name: string; guest_facing_name: string | null; room_number: string | null; short_name: string | null }
type Template = 'showcase' | 'checkin'
type SendVia = 'sms' | 'email'

type SmsRateInfo = {
  country_name: string
  phone_prefix: string | null
  markup_rate_usd: number
} | null

// ── Component ─────────────────────────────────────────────────────────────────

export default function SendPage() {
  const router = useRouter()
  const [properties, setProperties] = useState<Property[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [template, setTemplate] = useState<Template>('showcase')
  const [propertyId, setPropertyId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [language, setLanguage] = useState('en')
  const [sendVia, setSendVia] = useState<SendVia>('sms')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [smsRate, setSmsRate] = useState<SmsRateInfo>(null)
  const [rateLoading, setRateLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const [ownerLang, setOwnerLang] = useState<LangKey>('en')

  // ── Translation helper ────────────────────────────────────────────────────
  const t = (key: StringKey): string => {
    const langStrings = UI_STRINGS[ownerLang] as typeof UI_STRINGS['en']
    return langStrings[key] ?? UI_STRINGS.en[key]
  }

  useEffect(() => { loadProperties() }, [])
  useEffect(() => { if (propertyId) loadRooms(propertyId) }, [propertyId])

  // Debounced SMS rate lookup
  const lookupRate = useCallback(async (phoneVal: string) => {
    const cleaned = phoneVal.trim().replace(/[\s\-\(\)]/g, '')
    if (!cleaned.startsWith('+') || cleaned.length < 6) {
      setSmsRate(null)
      return
    }
    setRateLoading(true)
    try {
      const res = await fetch(`/api/sms-rate?phone=${encodeURIComponent(cleaned)}`)
      if (res.ok) {
        const data = await res.json()
        setSmsRate(data)
      } else {
        setSmsRate(null)
      }
    } catch {
      setSmsRate(null)
    } finally {
      setRateLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sendVia !== 'sms') { setSmsRate(null); return }
    const timer = setTimeout(() => lookupRate(phone), 600)
    return () => clearTimeout(timer)
  }, [phone, sendVia, lookupRate])

  async function loadProperties() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUserId(session.user.id)

    // ── Detect owner UI language ────────────────────────────────────────────
    // Priority: users.default_language → browser language → 'en'
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('default_language')
        .eq('id', session.user.id)
        .single()

      const dbLang = userData?.default_language?.toLowerCase?.()
      const browserLang = typeof navigator !== 'undefined'
        ? navigator.language?.slice(0, 2).toLowerCase()
        : 'en'

      const resolved = dbLang && SUPPORTED_LANGS.includes(dbLang as LangKey)
        ? (dbLang as LangKey)
        : SUPPORTED_LANGS.includes(browserLang as LangKey)
          ? (browserLang as LangKey)
          : 'en'

      setOwnerLang(resolved)
    } catch {
      // Fall through to English
    }

    const { data } = await supabase
      .from('properties')
      .select('id, name, primary_language')
      .eq('owner_id', session.user.id)
      .order('name')
    if (data && data.length > 0) {
      setProperties(data)
      setPropertyId(data[0].id)
      setLanguage(data[0].primary_language || 'en')
    }
    setLoading(false)
  }

  async function loadRooms(pid: string) {
    setRoomId('')
    const { data } = await supabase
      .from('rooms')
      .select('id, internal_name, guest_facing_name, room_number, short_name')
      .eq('property_id', pid)
      .order('room_number')
    setRooms(data || [])
    if (data && data.length > 0) setRoomId(data[0].id)
  }

  function handlePropertyChange(pid: string) {
    setPropertyId(pid)
    const prop = properties.find(p => p.id === pid)
    if (prop) setLanguage(prop.primary_language || 'en')
  }

  function roomLabel(r: Room) {
    const num = r.room_number ? `Rm ${r.room_number}` : null
    const name = r.short_name || r.guest_facing_name || r.internal_name
    return num ? `${num} · ${name}` : name
  }

  function switchSendVia(via: SendVia) {
    setSendVia(via)
    setError('')
    setSmsRate(null)
  }

  async function handleSend() {
    setError('')
    if (!propertyId) { setError(t('selectProperty')); return }
    if (!roomId) { setError(t('selectRoom')); return }
    if (!consent) { setError(t('confirmConsent')); return }
    if (sendVia === 'sms') {
      if (!phone.trim()) { setError(t('enterPhone')); return }
      const parsedPhone = parsePhoneNumberFromString(phone.trim())
      if (!parsedPhone || !parsedPhone.isValid()) { setError(t('phoneHint')); return }
    }
    if (sendVia === 'email' && !email.trim()) { setError(t('enterEmail')); return }

    setSending(true)
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template, propertyId, roomId, language,
          sendVia,
          phone: sendVia === 'sms' ? phone.trim() : undefined,
          email: sendVia === 'email' ? email.trim() : undefined,
          userId,
        }),
      })
      const json = await res.json()
      if (res.status === 403 && json?.error === 'account_cancelled') {
        setBlocked(true)
        return
      }
      if (!res.ok) throw new Error(json.error || t('somethingWrong'))
      setSentTo(sendVia === 'sms' ? phone.trim() : email.trim())
      setSent(true)
    } catch (e: any) {
      setError(e.message || t('somethingWrong'))
    } finally {
      setSending(false)
    }
  }

  function handleReset() {
    setSent(false)
    setPhone('')
    setEmail('')
    setError('')
    setConsent(false)
    setSmsRate(null)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div style={styles.centered}>
      <div style={styles.spinner} />
    </div>
  )

  if (blocked) return (
    <div style={styles.centered}>
      <div style={{ textAlign: 'center', padding: '0 32px' }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>👋</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 10px' }}>Welcome back!</h2>
        <p style={{ color: '#6B7280', fontSize: 15, margin: '0 0 8px', lineHeight: 1.5 }}>
          Your account is <strong style={{ color: '#111827' }}>cancelled</strong>, so sending is turned off.
        </p>
        <p style={{ color: '#6B7280', fontSize: 15, margin: '0 0 36px', lineHeight: 1.5 }}>
          Reactivate to start sending guest links again.
        </p>
        <a href="https://owner.ivrly.com/owner/billing" style={{
          display: 'inline-block', background: '#DC2626', color: '#fff', textDecoration: 'none',
          borderRadius: 12, padding: '15px 28px', fontSize: 16, fontWeight: 600,
        }}>Reactivate account</a>
      </div>
    </div>
  )

  if (sent) return (
    <div style={styles.centered}>
      <div style={{ textAlign: 'center', padding: '0 32px' }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 10px' }}>{t('sent')}</h2>
        <p style={{ color: '#6B7280', fontSize: 15, margin: '0 0 36px', lineHeight: 1.5 }}>
          {t('guestLinkDelivered')}<br />
          <strong style={{ color: '#111827' }}>{sentTo}</strong>
        </p>
        <button onClick={handleReset} style={{ ...styles.primaryBtn, marginBottom: 0 }}>
          {t('sendAnother')}
        </button>
      </div>
    </div>
  )

  return (
    <div style={styles.page}>

      {/* Sign out modal */}
      {showSignOutModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 10px' }}>{t('signOutTitle')}</h2>
            <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px', lineHeight: 1.5 }}>
              {t('signOutDesc')}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSignOutModal(false)} style={styles.cancelBtn}>{t('cancel')}</button>
              <button onClick={handleSignOut} style={styles.signOutConfirmBtn}>{t('signOut')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logoMark}>A</div>
        <button onClick={() => setShowSignOutModal(true)} style={styles.signOutBtn}>{t('signOut')}</button>
      </div>

      {/* Form */}
      <div style={styles.form}>

        {/* Message type */}
        <div style={styles.field}>
          <label style={styles.label}>{t('messageType')}</label>
          <div style={styles.toggleRow}>
            {(['showcase', 'checkin'] as Template[]).map(val => (
              <button
                key={val}
                onClick={() => setTemplate(val)}
                style={{
                  ...styles.toggleBtn,
                  background: template === val ? '#4F46E5' : '#F3F4F6',
                  color: template === val ? '#fff' : '#374151',
                  fontWeight: template === val ? 600 : 400,
                }}
              >
                {val === 'showcase' ? t('roomShowcase') : t('selfCheckin')}
              </button>
            ))}
          </div>
        </div>

        {/* Property */}
        <div style={styles.field}>
          <label style={styles.label}>{t('property')}</label>
          <select value={propertyId} onChange={e => handlePropertyChange(e.target.value)} style={styles.select}>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Room */}
        <div style={styles.field}>
          <label style={styles.label}>{t('room')}</label>
          {rooms.length === 0
            ? <p style={{ color: '#9CA3AF', fontSize: 14, margin: 0 }}>{t('noRooms')}</p>
            : (
              <select value={roomId} onChange={e => setRoomId(e.target.value)} style={styles.select}>
                {rooms.map(r => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
              </select>
            )}
        </div>

        {/* Language */}
        <div style={styles.field}>
          <label style={styles.label}>{t('language')}</label>
          <select value={language} onChange={e => setLanguage(e.target.value)} style={styles.select}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>

        {/* Delivery method */}
        <div style={styles.field}>
          <label style={styles.label}>{t('deliveryMethod')}</label>
          <div style={styles.toggleRow}>
            <button
              onClick={() => switchSendVia('sms')}
              style={{
                ...styles.toggleBtn,
                background: sendVia === 'sms' ? '#4F46E5' : '#F3F4F6',
                color: sendVia === 'sms' ? '#fff' : '#374151',
                fontWeight: sendVia === 'sms' ? 600 : 400,
              }}
            >
              📱 {t('sms')}
            </button>
            <button
              onClick={() => switchSendVia('email')}
              style={{
                ...styles.toggleBtn,
                background: sendVia === 'email' ? '#059669' : '#F3F4F6',
                color: sendVia === 'email' ? '#fff' : '#374151',
                fontWeight: sendVia === 'email' ? 600 : 400,
              }}
            >
              ✉️ {t('emailFree')}
            </button>
          </div>
        </div>

        {/* SMS: phone + rate display */}
        {sendVia === 'sms' && (
          <div style={styles.field}>
            <label style={styles.label}>{t('guestPhone')}</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+48 123 456 789"
              style={styles.input}
            />
            <p style={styles.hint}>{t('phoneHint')}</p>

            {rateLoading && (
              <div style={styles.rateBox}>
                <span style={{ color: '#9CA3AF', fontSize: 13 }}>{t('lookingUpRate')}</span>
              </div>
            )}
            {!rateLoading && smsRate && (
              <div style={styles.rateBox}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 14, color: '#111827', fontWeight: 600 }}>
                      📱 {t('smsTo')} {smsRate.country_name}
                      {smsRate.phone_prefix ? ` (${smsRate.phone_prefix})` : ''}
                    </span>
                    <span style={{ fontSize: 14, color: '#374151' }}>
                      {' '}— <strong>${smsRate.markup_rate_usd.toFixed(3)}</strong> {t('perMessage')}
                    </span>
                  </div>
                  <button
                    onClick={() => switchSendVia('email')}
                    style={styles.switchToEmailBtn}
                  >
                    ✉️ {t('sendFreeEmail')}
                  </button>
                </div>
              </div>
            )}
            {!rateLoading && !smsRate && phone.trim().length > 4 && (
              <div style={{ ...styles.rateBox, background: '#FEF3C7', borderColor: '#FCD34D' }}>
                <span style={{ fontSize: 13, color: '#92400E' }}>
                  {t('enterRateHint')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Email */}
        {sendVia === 'email' && (
          <div style={styles.field}>
            <label style={styles.label}>{t('guestEmail')}</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="guest@example.com"
              style={styles.input}
            />
            <div style={{ ...styles.rateBox, background: '#ECFDF5', borderColor: '#6EE7B7', marginTop: 8 }}>
              <span style={{ fontSize: 13, color: '#065F46', fontWeight: 500 }}>
                ✉️ {t('emailFreeNote')}
              </span>
            </div>
          </div>
        )}

        {/* Consent */}
        <div style={styles.field}>
          <label style={styles.label}>{t('reasonForSending')}</label>
          <div style={styles.consentBox}>
            <label style={styles.consentOption}>
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                style={styles.radio}
              />
              <div>
                <span style={styles.consentTitle}>{t('guestRequested')}</span>
                <span style={styles.consentDesc}>{t('guestRequestedDesc')}</span>
              </div>
            </label>
          </div>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <button
          onClick={handleSend}
          disabled={sending || !consent}
          style={{
            ...styles.primaryBtn,
            background: sending
              ? '#A5B4FC'
              : !consent
                ? '#D1D5DB'
                : sendVia === 'email'
                  ? '#059669'
                  : '#4F46E5',
            cursor: (sending || !consent) ? 'not-allowed' : 'pointer',
          }}
        >
          {sending
            ? t('sending')
            : sendVia === 'email'
              ? t('sendViaEmail')
              : t('sendViaSms')}
        </button>

      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#F9FAFB', paddingBottom: 40 },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', background: '#fff', borderBottom: '1px solid #E5E7EB',
    position: 'sticky', top: 0, zIndex: 10,
  },
  logoMark: {
    width: 36, height: 36, borderRadius: 10, background: '#4F46E5',
    color: '#fff', fontSize: 18, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  signOutBtn: { background: 'none', border: 'none', color: '#9CA3AF', fontSize: 13, cursor: 'pointer', padding: '4px 8px' },
  form: { padding: '24px 20px', maxWidth: 480, margin: '0 auto' },
  field: { marginBottom: 22 },
  label: {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#374151',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8,
  },
  toggleRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  toggleBtn: { padding: '12px 8px', borderRadius: 10, border: 'none', fontSize: 14, cursor: 'pointer', transition: 'all 0.15s' },
  select: {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid #E5E7EB', fontSize: 15, color: '#111827',
    background: '#fff', boxSizing: 'border-box' as const, appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239CA3AF' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36,
  },
  input: {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid #E5E7EB', fontSize: 16, color: '#111827',
    background: '#fff', boxSizing: 'border-box' as const, outline: 'none',
  },
  hint: { fontSize: 12, color: '#9CA3AF', margin: '6px 0 0' },
  rateBox: {
    marginTop: 10, padding: '10px 14px',
    background: '#EEF2FF', border: '1px solid #C7D2FE',
    borderRadius: 8, fontSize: 13,
  },
  switchToEmailBtn: {
    background: 'none', border: '1px solid #059669', color: '#059669',
    fontSize: 12, fontWeight: 600, padding: '5px 10px',
    borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' as const,
  },
  consentBox: { border: '1.5px solid #E5E7EB', borderRadius: 10, background: '#fff', overflow: 'hidden' },
  consentOption: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', cursor: 'pointer' },
  consentTitle: { display: 'block', fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 3 },
  consentDesc: { display: 'block', fontSize: 12, color: '#6B7280', lineHeight: 1.5 },
  radio: { marginTop: 2, accentColor: '#4F46E5', flexShrink: 0 },
  primaryBtn: {
    width: '100%', padding: '15px', borderRadius: 12, border: 'none',
    color: '#fff', fontSize: 16, fontWeight: 600, transition: 'background 0.2s', marginBottom: 16,
  },
  errorBox: {
    background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
    padding: '10px 14px', color: '#DC2626', fontSize: 14, marginBottom: 16,
  },
  centered: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  spinner: {
    width: 32, height: 32, border: '3px solid #E5E7EB',
    borderTop: '3px solid #4F46E5', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: { background: '#fff', borderRadius: 16, padding: 32, maxWidth: 320, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
  cancelBtn: { padding: '10px 20px', fontSize: 14, color: '#6B7280', background: 'transparent', border: '1px solid #E5E7EB', borderRadius: 10, cursor: 'pointer' },
  signOutConfirmBtn: { padding: '10px 20px', fontSize: 14, fontWeight: 600, color: '#fff', background: '#DC2626', border: 'none', borderRadius: 10, cursor: 'pointer' },
}
