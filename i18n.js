/* i18n.js — language switcher for OfflineGames.
 *
 * Load LAST, after ui-fx.js (it adds a row to the sidebar ui-fx.js builds).
 *
 * What it does
 *   • Adds a globe dropdown to the sidebar with 14 languages.
 *   • Translates the site's INTERFACE and STATIC CONTENT — navigation, buttons,
 *     hero, category names, content ratings, footer, page headings, prose,
 *     contact panel, guides — from a hand-written dictionary.
 *     Nothing is machine translated at runtime and nothing is sent anywhere.
 *   • Remembers the choice in localStorage and picks up the browser's language
 *     on a first visit.
 *   • Switches to right-to-left layout for Arabic.
 *
 * Adding a string: put the English text as a key in STR with 13 translations
 * in the same order as LANGS (minus English). Text that has no entry is simply
 * left in English, so a missing translation can never blank out the page.
 * Long prose lives in i18n-content.js (OG_TEXT) which is merged here.
 */
(function () {
  "use strict";

  var KEY = "og-lang";

  /* Order matters: every array in STR follows this list, skipping English. */
  var LANGS = [
    { c: "en",    n: "English"    },
    { c: "es",    n: "Espa\u00f1ol"   },
    { c: "zh-CN", n: "\u7b80\u4f53\u4e2d\u6587"      },
    { c: "zh-TW", n: "\u7e41\u9ad4\u4e2d\u6587"      },
    { c: "hi",    n: "\u0939\u093f\u0928\u094d\u0926\u0940"    },
    { c: "ar",    n: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629", rtl: true },
    { c: "fr",    n: "Fran\u00e7ais"   },
    { c: "de",    n: "Deutsch"    },
    { c: "pt",    n: "Portugu\u00eas"  },
    { c: "ja",    n: "\u65e5\u672c\u8a9e"       },
    { c: "ko",    n: "\ud55c\uad6d\uc5b4"       },
    { c: "ru",    n: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439"    },
    { c: "it",    n: "Italiano"   },
    { c: "tr",    n: "T\u00fcrk\u00e7e"     }
  ];

  /* es, zh-CN, zh-TW, hi, ar, fr, de, pt, ja, ko, ru, it, tr */
  var STR = {
    /* --- navigation ------------------------------------------------------ */
    "Vault":   ["B\u00f3veda","\u6e38\u620f\u5e93","\u904a\u6232\u5eab","\u0935\u0949\u0932\u094d\u091f","\u0627\u0644\u062e\u0632\u0646\u0629","Coffre","Tresor","Cofre","\u30dc\u30fc\u30eb\u30c8","\ubcfc\ud2b8","\u0425\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435","Caveau","Kasa"],
    "News":    ["Noticias","\u65b0\u95fb","\u65b0\u805e","\u0938\u092e\u093e\u091a\u093e\u0930","\u0627\u0644\u0623\u062e\u0628\u0627\u0631","Actualit\u00e9s","Neuigkeiten","Not\u00edcias","\u30cb\u30e5\u30fc\u30b9","\ub274\uc2a4","\u041d\u043e\u0432\u043e\u0441\u0442\u0438","Novit\u00e0","Haberler"],
    "About":   ["Acerca de","\u5173\u4e8e","\u95dc\u65bc","\u092a\u0930\u093f\u091a\u092f","\u062d\u0648\u0644","\u00c0 propos","\u00dcber uns","Sobre","\u6982\u8981","\uc18c\uac1c","\u041e \u0441\u0430\u0439\u0442\u0435","Informazioni","Hakk\u0131nda"],
    "Guides":  ["Gu\u00edas","\u653b\u7565","\u653b\u7565","\u0917\u093e\u0907\u0921","\u0627\u0644\u0623\u062f\u0644\u0629","Guides","Anleitungen","Guias","\u30ac\u30a4\u30c9","\uac00\uc774\ub4dc","\u0413\u0430\u0439\u0434\u044b","Guide","Rehberler"],
    "Contact": ["Contacto","\u8054\u7cfb\u6211\u4eec","\u806f\u7d61\u6211\u5011","\u0938\u0902\u092a\u0930\u094d\u0915","\u0627\u062a\u0635\u0644 \u0628\u0646\u0627","Contact","Kontakt","Contato","\u304a\u554f\u3044\u5408\u308f\u305b","\ubb38\uc758","Kontakty","Contatti","\u0130leti\u015fim"],
    "Privacy": ["Privacidad","\u9690\u79c1","\u96b1\u79c1","\u0917\u094b\u092a\u0928\u0940\u092f\u0924\u093e","\u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629","Confidentialit\u00e9","Datenschutz","Privacidade","\u30d7\u30e9\u30a4\u30d0\u30b7\u30fc","\uac1c\uc778\uc815\ubcf4","\u041a\u043e\u043d\u0444\u0438\u0434\u0435\u043d\u0446\u0438\u0430\u043b\u044c\u043d\u043e\u0441\u0442\u044c","Privacy","Gizlilik"],
    "Credits": ["Cr\u00e9ditos","\u7248\u6743\u4fe1\u606f","\u7248\u6b0a\u8cc7\u8a0a","\u0915\u094d\u0930\u0947\u0921\u093f\u091f","\u062d\u0642\u0648\u0642 \u0627\u0644\u0639\u0645\u0644","Cr\u00e9dits","Credits","Cr\u00e9ditos","\u30af\u30ec\u30b8\u30c3\u30c8","\ud06c\ub808\ub527","\u0410\u0432\u0442\u043e\u0440\u044b","Crediti","K\u00fcnye"],
    "Terms":   ["T\u00e9rminos","\u4f7f\u7528\u6761\u6b3e","\u4f7f\u7528\u689d\u6b3e","\u0936\u0930\u094d\u0924\u0947\u0902","\u0627\u0644\u0634\u0631\u0648\u0637","Conditions","Nutzungsbedingungen","Termos","\u5229\u7528\u898f\u7d04","\uc774\uc6a9\uc57d\uad00","\u0423\u0441\u043b\u043e\u0432\u0438\u044f","Termini","Ko\u015fullar"],

    /* --- sidebar and menu ------------------------------------------------ */
    "Categories":     ["Categor\u00edas","\u5206\u7c7b","\u5206\u985e","\u0936\u094d\u0930\u0947\u0923\u093f\u092f\u093e\u0901","\u0627\u0644\u0641\u0626\u0627\u062a","Cat\u00e9gories","Kategorien","Categorias","\u30ab\u30c6\u30b4\u30ea","\uce74\ud14c\uace0\ub9ac","\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438","Categorie","Kategoriler"],
    "All games":      ["Todos los juegos","\u5168\u90e8\u6e38\u620f","\u5168\u90e8\u904a\u6232","\u0938\u092d\u0940 \u0917\u0947\u092e","\u0643\u0644 \u0627\u0644\u0623\u0644\u0639\u0627\u0628","Tous les jeux","Alle Spiele","Todos os jogos","\u3059\u3079\u3066\u306e\u30b2\u30fc\u30e0","\uc804\uccb4 \uac8c\uc784","\u0412\u0441\u0435 \u0438\u0433\u0440\u044b","Tutti i giochi","T\u00fcm oyunlar"],
    "All categories": ["Todas las categor\u00edas","\u5168\u90e8\u5206\u7c7b","\u5168\u90e8\u5206\u985e","\u0938\u092d\u0940 \u0936\u094d\u0930\u0947\u0923\u093f\u092f\u093e\u0901","\u0643\u0644 \u0627\u0644\u0641\u0626\u0627\u062a","Toutes les cat\u00e9gories","Alle Kategorien","Todas as categorias","\u3059\u3079\u3066\u306e\u30ab\u30c6\u30b4\u30ea","\uc804\uccb4 \uce74\ud14c\uace0\ub9ac","\u0412\u0441\u0435 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438","Tutte le categorie","T\u00fcm kategoriler"],
    "\u2715 Show all":     ["\u2715 Mostrar todo","\u2715 \u663e\u793a\u5168\u90e8","\u2715 \u986f\u793a\u5168\u90e8","\u2715 \u0938\u092d\u0940 \u0926\u093f\u0916\u093e\u090f\u0901","\u2715 \u0639\u0631\u0636 \u0627\u0644\u0643\u0644","\u2715 Tout afficher","\u2715 Alle anzeigen","\u2715 Mostrar tudo","\u2715 \u3059\u3079\u3066\u8868\u793a","\u2715 \uc804\uccb4 \ubcf4\uae30","\u2715 \u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0432\u0441\u0435","\u2715 Mostra tutto","\u2715 T\u00fcm\u00fcn\u00fc g\u00f6ster"],
    "Language":       ["Idioma","\u8bed\u8a00","\u8a9e\u8a00","\u092d\u093e\u0937\u093e","\u0627\u0644\u0644\u063a\u0629","Langue","Sprache","Idioma","\u8a00\u8a9e","\uc5b8\uc5b4","\u042f\u0437\u044b\u043a","Lingua","Dil"],
    "Site menu":      ["Men\u00fa del sitio","\u7f51\u7ad9\u83dc\u5355","\u7db2\u7ad9\u9078\u55ae","\u0938\u093e\u0907\u091f \u092e\u0947\u0928\u0942","\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0648\u0642\u0639","Menu du site","Seitenmen\u00fc","Menu do site","\u30b5\u30a4\u30c8\u30e1\u30cb\u30e5\u30fc","\uc0ac\uc774\ud2b8 \uba54\ub274","\u041c\u0435\u043d\u044e \u0441\u0430\u0439\u0442\u0430","Menu del sito","Site men\u00fcs\u00fc"],
    "Open menu":      ["Abrir men\u00fa","\u6253\u5f00\u83dc\u5355","\u6253\u958b\u9078\u55ae","\u092e\u0947\u0928\u0942 \u0916\u094b\u0932\u0947\u0902","\u0641\u062a\u062d \u0627\u0644\u0642\u0627\u0626\u0645\u0629","Ouvrir le menu","Men\u00fc \u00f6ffnen","Abrir menu","\u30e1\u30cb\u30e5\u30fc\u3092\u958b\u304f","\uba54\ub274 \uc5f4\uae30","\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e","Apri il menu","Men\u00fcy\u00fc a\u00e7"],
    "Close menu":     ["Cerrar men\u00fa","\u5173\u95ed\u83dc\u5355","\u95dc\u9589\u9078\u55ae","\u092e\u0947\u0928\u0942 \u092c\u0902\u0926 \u0915\u0930\u0947\u0902","\u0625\u063a\u0644\u0627\u0642 \u0627\u0644\u0642\u0627\u0626\u0645\u0629","Fermer le menu","Men\u00fc schlie\u00dfen","Fechar menu","\u30e1\u30cb\u30e5\u30fc\u3092\u9589\u3058\u308b","\uba54\ub274 \ub2eb\uae30","\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e","Chiudi il menu","Men\u00fcy\u00fc kapat"],
    "Collapse menu":  ["Contraer men\u00fa","\u6536\u8d77\u83dc\u5355","\u6536\u8d77\u9078\u55ae","\u092e\u0947\u0928\u0942 \u0938\u0902\u0915\u0941\u091a\u093f\u0924 \u0915\u0930\u0947\u0902","\u0637\u064a \u0627\u0644\u0642\u0627\u0626\u0645\u0629","R\u00e9duire le menu","Men\u00fc einklappen","Recolher menu","\u30e1\u30cb\u30e5\u30fc\u3092\u7e2e\u5c0f","\uba54\ub274 \uc811\uae30","\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u043c\u0435\u043d\u044e","Riduci il menu","Men\u00fcy\u00fc daralt"],
    "Expand menu":    ["Expandir men\u00fa","\u5c55\u5f00\u83dc\u5355","\u5c55\u958b\u9078\u55ae","\u092e\u0947\u0928\u0942 \u092b\u0948\u0932\u093e\u090f\u0901","\u062a\u0648\u0633\u064a\u0639 \u0627\u0644\u0642\u0627\u0626\u0645\u0629","Agrandir le menu","Men\u00fc ausklappen","Expandir menu","\u30e1\u30cb\u30e5\u30fc\u3092\u5c55\u958b","\uba54\ub274 \ud3bc\uce58\uae30","\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u043c\u0435\u043d\u044e","Espandi il menu","Men\u00fcy\u00fc geni\u015flet"],

    /* --- search ----------------------------------------------------------- */
    "Search\u2026":       ["Buscar\u2026","\u641c\u7d22\u2026","\u641c\u5c0b\u2026","\u0916\u094b\u091c\u0947\u0902\u2026","\u0628\u062d\u062b\u2026","Rechercher\u2026","Suchen\u2026","Pesquisar\u2026","\u691c\u7d22\u2026","\uac80\uc0c9\u2026","\u041f\u043e\u0438\u0441\u043a\u2026","Cerca\u2026","Ara\u2026"],
    "Search games":   ["Buscar juegos","\u641c\u7d22\u6e38\u620f","\u641c\u5c0b\u904a\u6232","\u0917\u0947\u092e \u0916\u094b\u091c\u0947\u0902","\u0627\u0628\u062d\u062b \u0639\u0646 \u0627\u0644\u0623\u0644\u0639\u0627\u0628","Rechercher des jeux","Spiele suchen","Pesquisar jogos","\u30b2\u30fc\u30e0\u3092\u691c\u7d22","\uac8c\uc784 \uac80\uc0c9","\u041f\u043e\u0438\u0441\u043a \u0438\u0433\u0440","Cerca giochi","Oyun ara"],

    /* --- hero -------------------------------------------------------------- */
    "The vault is open": ["La b\u00f3veda est\u00e1 abierta","\u6e38\u620f\u5e93\u5df2\u5f00\u542f","\u904a\u6232\u5eab\u5df2\u958b\u555f","\u0935\u0949\u0932\u094d\u091f \u0916\u0941\u0932\u093e \u0939\u0948","\u0627\u0644\u062e\u0632\u0646\u0629 \u0645\u0641\u062a\u0648\u062d\u0629","Le coffre est ouvert","Der Tresor ist offen","O cofre est\u00e1 aberto","\u30dc\u30fc\u30eb\u30c8\u306f\u958b\u3044\u3066\u3044\u307e\u3059","\ubcfc\ud2b8\uac00 \uc5f4\ub838\uc2b5\ub2c8\ub2e4","\u0425\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435 \u043e\u0442\u043a\u0440\u044b\u0442\u043e","Il caveau \u00e8 aperto","Kasa a\u00e7\u0131k"],
    "Play now.":         ["Juega ahora.","\u7acb\u5373\u5f00\u73a9\u3002","\u7acb\u5373\u958b\u73a9\u3002","\u0905\u092d\u0940 \u0916\u0947\u0932\u0947\u0902\u0964","\u0627\u0644\u0639\u0628 \u0627\u0644\u0622\u0646.","Jouez maintenant.","Jetzt spielen.","Jogue agora.","\u4eca\u3059\u3050\u30d7\u30ec\u30a4\u3002","\uc9c0\uae08 \ud50c\ub808\uc774\ud558\uc138\uc694.","\u0418\u0433\u0440\u0430\u0439\u0442\u0435 \u0441\u0435\u0439\u0447\u0430\u0441.","Gioca ora.","Hemen oyna."],
    "Pick a cartridge. Start playing.": ["Elige un cartucho. Empieza a jugar.","\u9009\u4e00\u4e2a\u5361\u5e26\uff0c\u9a6c\u4e0a\u5f00\u73a9\u3002","\u9078\u4e00\u500b\u5361\u5e36\uff0c\u99ac\u4e0a\u958b\u73a9\u3002","\u090f\u0915 \u0915\u093e\u0930\u094d\u091f\u094d\u0930\u093f\u091c \u091a\u0941\u0928\u0947\u0902\u0964 \u0916\u0947\u0932\u0928\u093e \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902\u0964","\u0627\u062e\u062a\u0631 \u062e\u0631\u0637\u0648\u0634\u0629 \u0648\u0627\u0628\u062f\u0623 \u0627\u0644\u0644\u0639\u0628.","Choisissez une cartouche. Commencez \u00e0 jouer.","W\u00e4hl ein Modul. Leg los.","Escolha um cartucho. Comece a jogar.","\u30ab\u30fc\u30c8\u30ea\u30c3\u30b8\u3092\u9078\u3093\u3067\u3001\u3059\u3050\u30d7\u30ec\u30a4\u3002","\uce74\ud2b8\ub9ac\uc9c0\ub97c \uace0\ub974\uace0 \ubc14\ub85c \ud50c\ub808\uc774\ud558\uc138\uc694.","\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u0430\u0440\u0442\u0440\u0438\u0434\u0436 \u0438 \u0438\u0433\u0440\u0430\u0439\u0442\u0435.","Scegli una cartuccia. Inizia a giocare.","Bir kartu\u015f se\u00e7. Oynamaya ba\u015fla."],
    "No downloads, no accounts \u2014 just cabinets ready when you are. Hover to preview, tap to play, or let the vault pick for you.": [
      "Sin descargas ni cuentas: solo m\u00e1quinas listas cuando t\u00fa lo est\u00e9s. Pasa el rat\u00f3n para ver una vista previa, toca para jugar o deja que la b\u00f3veda elija por ti.",
      "\u65e0\u9700\u4e0b\u8f7d\uff0c\u65e0\u9700\u8d26\u53f7\u2014\u2014\u673a\u53f0\u968f\u65f6\u5f85\u547d\u3002\u60ac\u505c\u9884\u89c8\uff0c\u70b9\u51fb\u5f00\u73a9\uff0c\u6216\u8005\u8ba9\u6e38\u620f\u5e93\u66ff\u4f60\u6311\u3002",
      "\u7121\u9700\u4e0b\u8f09\uff0c\u7121\u9700\u5e33\u865f\u2014\u2014\u6a5f\u53f0\u96a8\u6642\u5f85\u547d\u3002\u61f8\u505c\u9810\u89bd\uff0c\u9ede\u64ca\u958b\u73a9\uff0c\u6216\u8005\u8b93\u904a\u6232\u5eab\u66ff\u4f60\u6311\u3002",
      "\u0928 \u0921\u093e\u0909\u0928\u0932\u094b\u0921, \u0928 \u0916\u093e\u0924\u093e \u2014 \u092c\u0938 \u0915\u0948\u092c\u093f\u0928\u0947\u091f \u0924\u0948\u092f\u093e\u0930 \u0939\u0948\u0902\u0964 \u091d\u0932\u0915 \u0926\u0947\u0916\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u0939\u094b\u0935\u0930 \u0915\u0930\u0947\u0902, \u0916\u0947\u0932\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u091f\u0948\u092a \u0915\u0930\u0947\u0902, \u092f\u093e \u0935\u0949\u0932\u094d\u091f \u0915\u094b \u091a\u0941\u0928\u0928\u0947 \u0926\u0947\u0902\u0964",
      "\u0628\u0644\u0627 \u062a\u0646\u0632\u064a\u0644 \u0648\u0628\u0644\u0627 \u062d\u0633\u0627\u0628\u0627\u062a \u2014 \u0645\u062c\u0631\u062f \u0623\u062c\u0647\u0632\u0629 \u062c\u0627\u0647\u0632\u0629 \u0645\u062a\u0649 \u0645\u0627 \u0643\u0646\u062a \u062c\u0627\u0647\u0632\u064b\u0627. \u0645\u0631\u0651\u0631 \u0627\u0644\u0645\u0624\u0634\u0631 \u0644\u0644\u0645\u0639\u0627\u064a\u0646\u0629\u060c \u0623\u0648 \u0627\u0646\u0642\u0631 \u0644\u0644\u0639\u0628\u060c \u0623\u0648 \u062f\u0639 \u0627\u0644\u062e\u0632\u0646\u0629 \u062a\u062e\u062a\u0627\u0631 \u0644\u0643.",
      "Pas de t\u00e9l\u00e9chargement, pas de compte \u2014 juste des bornes pr\u00eates quand vous l'\u00eates. Survolez pour un aper\u00e7u, touchez pour jouer, ou laissez le coffre choisir pour vous.",
      "Kein Download, kein Konto \u2014 nur Automaten, die bereitstehen. Zeig mit der Maus darauf f\u00fcr eine Vorschau, tippe zum Spielen, oder lass den Tresor w\u00e4hlen.",
      "Sem downloads, sem contas \u2014 s\u00f3 m\u00e1quinas prontas quando voc\u00ea estiver. Passe o mouse para ver uma pr\u00e9via, toque para jogar ou deixe o cofre escolher por voc\u00ea.",
      "\u30c0\u30a6\u30f3\u30ed\u30fc\u30c9\u3082\u30a2\u30ab\u30a6\u30f3\u30c8\u3082\u4e0d\u8981\u3002\u7b50\u4f53\u306f\u3044\u3064\u3067\u3082\u6e96\u5099\u4e07\u7aef\u3002\u30ab\u30fc\u30bd\u30eb\u3092\u5408\u308f\u305b\u3066\u30d7\u30ec\u30d3\u30e5\u30fc\u3001\u30bf\u30c3\u30d7\u3067\u30d7\u30ec\u30a4\u3001\u8ff7\u3063\u305f\u3089\u30dc\u30fc\u30eb\u30c8\u306b\u4efb\u305b\u3066\u3002",
      "\ub2e4\uc6b4\ub85c\ub4dc\ub3c4 \uacc4\uc815\ub3c4 \ud544\uc694 \uc5c6\uc2b5\ub2c8\ub2e4. \uae30\uae30\ub294 \uc5b8\uc81c\ub4e0 \uc900\ube44\ub418\uc5b4 \uc788\uc2b5\ub2c8\ub2e4. \ub9c8\uc6b0\uc2a4\ub97c \uc62c\ub824 \ubbf8\ub9ac\ubcf4\uace0, \ud0ed\ud574\uc11c \ud50c\ub808\uc774\ud558\uac70\ub098, \ubcfc\ud2b8\uc5d0\uac8c \ub9e1\uaca8\ubcf4\uc138\uc694.",
      "\u0411\u0435\u0437 \u0437\u0430\u0433\u0440\u0443\u0437\u043e\u043a \u0438 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u043e\u0432 \u2014 \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u044b \u0433\u043e\u0442\u043e\u0432\u044b, \u043a\u043e\u0433\u0434\u0430 \u0433\u043e\u0442\u043e\u0432\u044b \u0432\u044b. \u041d\u0430\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u0443\u0440\u0441\u043e\u0440 \u0434\u043b\u044f \u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430, \u043d\u0430\u0436\u043c\u0438\u0442\u0435, \u0447\u0442\u043e\u0431\u044b \u0438\u0433\u0440\u0430\u0442\u044c, \u0438\u043b\u0438 \u043f\u0443\u0441\u0442\u044c \u0445\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435 \u0432\u044b\u0431\u0435\u0440\u0435\u0442 \u0437\u0430 \u0432\u0430\u0441.",
      "Nessun download, nessun account \u2014 solo cabinati pronti quando lo sei tu. Passa il mouse per l'anteprima, tocca per giocare o lascia scegliere al caveau.",
      "\u0130ndirme yok, hesap yok \u2014 makineler siz haz\u0131r oldu\u011funda haz\u0131r. \u00d6nizleme i\u00e7in \u00fczerine gelin, oynamak i\u00e7in dokunun ya da se\u00e7imi kasaya b\u0131rak\u0131n."
    ],
    "Random Game": ["Juego aleatorio","\u968f\u673a\u6e38\u620f","\u96a8\u6a5f\u904a\u6232","\u0915\u094b\u0908 \u092d\u0940 \u0917\u0947\u092e","\u0644\u0639\u0628\u0629 \u0639\u0634\u0648\u0627\u0626\u064a\u0629","Jeu au hasard","Zuf\u00e4lliges Spiel","Jogo aleat\u00f3rio","\u30e9\u30f3\u30c0\u30e0\u30b2\u30fc\u30e0","\ub79c\ub364 \uac8c\uc784","\u0421\u043b\u0443\u0447\u0430\u0439\u043d\u0430\u044f \u0438\u0433\u0440\u0430","Gioco casuale","Rastgele oyun"],
    "Spotlight":   ["Destacado","\u7cbe\u9009","\u7cbe\u9078","\u0935\u093f\u0936\u0947\u0937","\u0645\u0645\u064a\u0632\u0629","\u00c0 la une","Im Fokus","Destaque","\u6ce8\u76ee","\ucd94\ucc9c","\u0412 \u0446\u0435\u043d\u0442\u0440\u0435 \u0432\u043d\u0438\u043c\u0430\u043d\u0438\u044f","In evidenza","\u00d6ne \u00e7\u0131kan"],

    /* --- grid, news, about strip ------------------------------------------ */
    "Nothing matches.":  ["No hay resultados.","\u6ca1\u6709\u5339\u914d\u7684\u7ed3\u679c\u3002","\u6c92\u6709\u7b26\u5408\u7684\u7d50\u679c\u3002","\u0915\u0941\u091b \u0928\u0939\u0940\u0902 \u092e\u093f\u0932\u093e\u0964","\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u062a\u0627\u0626\u062c.","Aucun r\u00e9sultat.","Keine Treffer.","Nenhum resultado.","\u8a72\u5f53\u306a\u3057\u3002","\uacb0\uacfc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.","\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e.","Nessun risultato.","Sonu\u00e7 yok."],
    "What's new":        ["Novedades","\u6700\u65b0\u52a8\u6001","\u6700\u65b0\u52d5\u614b","\u0928\u092f\u093e \u0915\u094d\u092f\u093e \u0939\u0948","\u0645\u0627 \u0627\u0644\u062c\u062f\u064a\u062f","Quoi de neuf","Neuigkeiten","Novidades","\u6700\u65b0\u60c5\u5831","\uc0c8 \uc18c\uc2dd","\u0427\u0442\u043e \u043d\u043e\u0432\u043e\u0433\u043e","Novit\u00e0","Yenilikler"],
    "About the vault":   ["Sobre la b\u00f3veda","\u5173\u4e8e\u6e38\u620f\u5e93","\u95dc\u65bc\u904a\u6232\u5eab","\u0935\u0949\u0932\u094d\u091f \u0915\u0947 \u092c\u093e\u0930\u0947 \u092e\u0947\u0902","\u0639\u0646 \u0627\u0644\u062e\u0632\u0646\u0629","\u00c0 propos du coffre","\u00dcber den Tresor","Sobre o cofre","\u30dc\u30fc\u30eb\u30c8\u306b\u3064\u3044\u3066","\ubcfc\ud2b8 \uc18c\uac1c","\u041e \u0445\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435","Il caveau","Kasa hakk\u0131nda"],
    "A free library of browser games": ["Una biblioteca gratuita de juegos de navegador","\u514d\u8d39\u7684\u7f51\u9875\u6e38\u620f\u5e93","\u514d\u8cbb\u7684\u7db2\u9801\u904a\u6232\u5eab","\u092c\u094d\u0930\u093e\u0909\u091c\u093c\u0930 \u0917\u0947\u092e \u0915\u0940 \u092e\u0941\u092b\u093c\u094d\u0924 \u0932\u093e\u0907\u092c\u094d\u0930\u0947\u0930\u0940","\u0645\u0643\u062a\u0628\u0629 \u0645\u062c\u0627\u0646\u064a\u0629 \u0644\u0623\u0644\u0639\u0627\u0628 \u0627\u0644\u0645\u062a\u0635\u0641\u062d","Une biblioth\u00e8que gratuite de jeux de navigateur","Eine kostenlose Sammlung von Browserspielen","Uma biblioteca gratuita de jogos de navegador","\u7121\u6599\u306e\u30d6\u30e9\u30a6\u30b6\u30b2\u30fc\u30e0\u30e9\u30a4\u30d6\u30e9\u30ea","\ubb34\ub8cc \ube0c\ub77c\uc6b0\uc800 \uac8c\uc784 \ub77c\uc774\ube0c\ub7ec\ub9ac","\u0411\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u0430\u044f \u0431\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0430 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u043d\u044b\u0445 \u0438\u0433\u0440","Una libreria gratuita di giochi per browser","\u00dccretsiz taray\u0131c\u0131 oyunlar\u0131 k\u00fct\u00fcphanesi"],
    "How we play":       ["C\u00f3mo jugamos","\u6211\u4eec\u600e\u4e48\u73a9","\u6211\u5011\u600e\u9ebc\u73a9","\u0939\u092e \u0915\u0948\u0938\u0947 \u0916\u0947\u0932\u0924\u0947 \u0939\u0948\u0902","\u0643\u064a\u0641 \u0646\u0644\u0639\u0628","Comment on joue","Wie wir spielen","Como jogamos","\u904a\u3073\u65b9","\ud50c\ub808\uc774 \ubc29\ubc95","\u041a\u0430\u043a \u043c\u044b \u0438\u0433\u0440\u0430\u0435\u043c","Come giochiamo","Nas\u0131l oynuyoruz"],
    "Who we are":        ["Qui\u00e9nes somos","\u5173\u4e8e\u6211\u4eec","\u95dc\u65bc\u6211\u5011","\u0939\u092e \u0915\u094c\u0928 \u0939\u0948\u0902","\u0645\u0646 \u0646\u062d\u0646","Qui sommes-nous","Wer wir sind","Quem somos","\u79c1\u305f\u3061\u306b\u3064\u3044\u3066","\uc6b0\ub9ac\ub294 \ub204\uad6c\uc778\uac00","\u041a\u0442\u043e \u043c\u044b","Chi siamo","Biz kimiz"],

    /* --- overlays and small controls --------------------------------------- */
    "Play this one": ["Jugar a este","\u73a9\u8fd9\u4e2a","\u73a9\u9019\u500b","\u092f\u0939\u0940 \u0916\u0947\u0932\u0947\u0902","\u0627\u0644\u0639\u0628 \u0647\u0630\u0647","Jouer \u00e0 celui-ci","Dieses spielen","Jogar este","\u3053\u308c\u3092\u30d7\u30ec\u30a4","\uc774\uac70 \ud50c\ub808\uc774","\u0418\u0433\u0440\u0430\u0442\u044c \u0432 \u044d\u0442\u0443","Gioca a questo","Bunu oyna"],
    "Close":         ["Cerrar","\u5173\u95ed","\u95dc\u9589","\u092c\u0902\u0926 \u0915\u0930\u0947\u0902","\u0625\u063a\u0644\u0627\u0642","Fermer","Schlie\u00dfen","Fechar","\u9589\u3058\u308b","\ub2eb\uae30","\u0417\u0430\u043a\u0440\u044b\u0442\u044c","Chiudi","Kapat"],
    "Details":       ["Detalles","\u8be6\u60c5","\u8a73\u60c5","\u0935\u093f\u0935\u0930\u0923","\u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644","D\u00e9tails","Details","Detalhes","\u8a73\u7d30","\uc790\uc138\ud788","\u041f\u043e\u0434\u0440\u043e\u0431\u043d\u0435\u0435","Dettagli","Ayr\u0131nt\u0131lar"],
    "Back to the vault": ["Volver a la b\u00f3veda","\u8fd4\u56de\u6e38\u620f\u5e93","\u8fd4\u56de\u904a\u6232\u5eab","\u0935\u0949\u0932\u094d\u091f \u092a\u0930 \u0935\u093e\u092a\u0938","\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0627\u0644\u062e\u0632\u0646\u0629","Retour au coffre","Zur\u00fcck zum Tresor","Voltar ao cofre","\u30dc\u30fc\u30eb\u30c8\u306b\u623b\u308b","\ubcfc\ud2b8\ub85c \ub3cc\uc544\uac00\uae30","\u041d\u0430\u0437\u0430\u0434 \u0432 \u0445\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435","Torna al caveau","Kasaya d\u00f6n"],
    "Open the vault":       ["Abrir la b\u00f3veda","\u6253\u5f00\u6e38\u620f\u5e93","\u6253\u958b\u904a\u6232\u5eab","\u0935\u0949\u0932\u094d\u091f \u0916\u094b\u0932\u0947\u0902","\u0627\u0641\u062a\u062d \u0627\u0644\u062e\u0632\u0646\u0629","Ouvrir le coffre","Tresor \u00f6ffnen","Abrir o cofre","\u30dc\u30fc\u30eb\u30c8\u3092\u958b\u304f","\ubcfc\ud2b8 \uc5f4\uae30","\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0445\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435","Apri il caveau","Kasay\u0131 a\u00e7"],
    "Open the contact form":["Abrir el formulario de contacto","\u6253\u5f00\u8054\u7cfb\u8868\u5355","\u6253\u958b\u806f\u7d61\u8868\u55ae","\u0938\u0902\u092a\u0930\u094d\u0915 \u092b\u093c\u0949\u0930\u094d\u092e \u0916\u094b\u0932\u0947\u0902","\u0627\u0641\u062a\u062d \u0646\u0645\u0648\u0630\u062c \u0627\u0644\u0627\u062a\u0635\u0627\u0644","Ouvrir le formulaire de contact","Kontaktformular \u00f6ffnen","Abrir o formul\u00e1rio de contato","\u304a\u554f\u3044\u5408\u308f\u305b\u30d5\u30a9\u30fc\u30e0\u3092\u958b\u304f","\ubb38\uc758 \uc591\uc2dd \uc5f4\uae30","\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0444\u043e\u0440\u043c\u0443 \u0441\u0432\u044f\u0437\u0438","Apri il modulo di contatto","\u0130leti\u015fim formunu a\u00e7"],

    /* --- content ratings ---------------------------------------------------- */
    "Everyone":     ["Para todos","\u6240\u6709\u4eba","\u6240\u6709\u4eba","\u0938\u092d\u0940 \u0915\u0947 \u0932\u093f\u090f","\u0644\u0644\u062c\u0645\u064a\u0639","Tout public","Ab 0","Livre","\u5168\u5e74\u9f62","\uc804\uccb4 \uc774\uc6a9\uac00","\u0414\u043b\u044f \u0432\u0441\u0435\u0445","Per tutti","Herkes"],
    "Everyone 10+": ["Mayores de 10","10\u5c81\u4ee5\u4e0a","10\u6b72\u4ee5\u4e0a","10+","+10 \u0633\u0646\u0648\u0627\u062a","D\u00e8s 10 ans","Ab 10","10+","10\u6b73\u4ee5\u4e0a","10\uc138 \uc774\uc0c1","\u041e\u0442 10 \u043b\u0435\u0442","Dai 10 anni","10+"],
    "Teen":         ["Adolescentes","\u9752\u5c11\u5e74","\u9752\u5c11\u5e74","\u0915\u093f\u0936\u094b\u0930","\u0644\u0644\u0645\u0631\u0627\u0647\u0642\u064a\u0646","Ados","Ab 13","Adolescentes","\u30c6\u30a3\u30fc\u30f3","\uccad\uc18c\ub144","\u041f\u043e\u0434\u0440\u043e\u0441\u0442\u043a\u0430\u043c","Teen","Gen\u00e7"],

    /* --- category names --------------------------------------------------- */
    "Arcade":   ["Arcade","\u8857\u673a","\u8857\u6a5f","\u0906\u0930\u094d\u0915\u0947\u0921","\u0623\u0631\u0643\u064a\u062f","Arcade","Arcade","Arcade","\u30a2\u30fc\u30b1\u30fc\u30c9","\uc544\uc98c","\u0410\u0440\u043a\u0430\u0434\u044b","Arcade","Atari"],
    "Puzzle":   ["Puzles","\u76ca\u667a","\u76ca\u667a","\u092a\u0939\u0947\u0932\u0940","\u0623\u0644\u063a\u0627\u0632","Puzzle","R\u00e4tsel","Quebra-cabe\u00e7a","\u30d1\u30ba\u30eb","\ud37c\uc990","\u0413\u043e\u043b\u043e\u0432\u043e\u043b\u043e\u043c\u043a\u0438","Puzzle","Bulmaca"],
    "Racing":   ["Carreras","\u8d5b\u8f66","\u8cfd\u8eca","\u0930\u0947\u0938\u093f\u0902\u0917","\u0633\u0628\u0627\u0642","Course","Rennen","Corrida","\u30ec\u30fc\u30b7\u30f3\u30b0","\ub808\uc774\uc2f1","\u0413\u043e\u043d\u043a\u0438","Corse","Yar\u0131\u015f"],
    "Chess":    ["Ajedrez","\u56fd\u9645\u8c61\u68cb","\u570b\u969b\u8c61\u68cb","\u0936\u0924\u0930\u0902\u091c","\u0627\u0644\u0634\u0637\u0631\u0646\u062c","\u00c9checs","Schach","Xadrez","\u30c1\u30a7\u30b9","\uccb4\uc2a4","\u0428\u0430\u0445\u043c\u0430\u0442\u044b","Scacchi","Satran\u00e7"],
    "Music":    ["M\u00fasica","\u97f3\u4e50","\u97f3\u6a02","\u0938\u0902\u0917\u0940\u0924","\u0645\u0648\u0633\u064a\u0642\u0649","Musique","Musik","M\u00fasica","\u97f3\u697d","\uc74c\uc545","\u041c\u0443\u0437\u044b\u043a\u0430","Musica","M\u00fczik"],
    "Shooting": ["Disparos","\u5c04\u51fb","\u5c04\u64ca","\u0936\u0942\u091f\u093f\u0902\u0917","\u0625\u0637\u0644\u0627\u0642 \u0627\u0644\u0646\u0627\u0631","Tir","Shooter","Tiro","\u30b7\u30e5\u30fc\u30c6\u30a3\u30f3\u30b0","\uc288\ud305","\u0421\u0442\u0440\u0435\u043b\u044f\u043b\u043a\u0438","Sparatutto","Ni\u015fanc\u0131"],
    "Drawing":  ["Dibujo","\u7ed8\u753b","\u7e6a\u756b","\u0921\u094d\u0930\u0949\u0907\u0902\u0917","\u0627\u0644\u0631\u0633\u0645","Dessin","Zeichnen","Desenho","\u304a\u7d75\u63cf\u304d","\uadf8\ub9ac\uae30","\u0420\u0438\u0441\u043e\u0432\u0430\u043d\u0438\u0435","Disegno","\u00c7izim"],
    "Flying":   ["Vuelo","\u98de\u884c","\u98db\u884c","\u0909\u0921\u093c\u093e\u0928","\u0627\u0644\u0637\u064a\u0631\u0627\u0646","Vol","Fliegen","Voo","\u30d5\u30e9\u30a4\u30c8","\ube44\ud589","\u041f\u043e\u043b\u0451\u0442\u044b","Volo","U\u00e7u\u015f"],
    "Fighting": ["Lucha","\u683c\u6597","\u683c\u9b25","\u092b\u093c\u093e\u0907\u091f\u093f\u0902\u0917","\u0642\u062a\u0627\u0644","Combat","Kampf","Luta","\u683c\u95d8","\ub300\uc804 \uaca9\ud22c","\u0424\u0430\u0439\u0442\u0438\u043d\u0433\u0438","Combattimento","D\u00f6v\u00fc\u015f"],
    "Skill":    ["Habilidad","\u6280\u5de7","\u6280\u5de7","\u0915\u094c\u0936\u0932","\u0645\u0647\u0627\u0631\u0629","Adresse","Geschick","Habilidade","\u30b9\u30ad\u30eb","\uc2a4\ud0ac","\u041d\u0430 \u043b\u043e\u0432\u043a\u043e\u0441\u0442\u044c","Abilit\u00e0","Beceri"],
    "Mind":     ["Mente","\u5934\u8111","\u982d\u8166","\u0926\u093f\u092e\u093e\u0917","\u0630\u0647\u0646\u064a\u0629","R\u00e9flexion","Denksport","Mente","\u982d\u8133","\ub450\ub1cc","\u041b\u043e\u0433\u0438\u043a\u0430","Mente","Zeka"],

    /* --- page eyebrows and headings ---------------------------------------- */
    "who we are":             ["qui\u00e9nes somos","\u5173\u4e8e\u6211\u4eec","\u95dc\u65bc\u6211\u5011","\u0939\u092e \u0915\u094c\u0928 \u0939\u0948\u0902","\u0645\u0646 \u0646\u062d\u0646","qui sommes-nous","wer wir sind","quem somos","\u79c1\u305f\u3061\u306b\u3064\u3044\u3066","\uc6b0\ub9ac\ub294 \ub204\uad6c\uc778\uac00","\u043a\u0442\u043e \u043c\u044b","chi siamo","biz kimiz"],
    "About OfflineGames":     ["Acerca de OfflineGames","\u5173\u4e8e OfflineGames","\u95dc\u65bc OfflineGames","OfflineGames \u0915\u0947 \u092c\u093e\u0930\u0947 \u092e\u0947\u0902","\u062d\u0648\u0644 OfflineGames","\u00c0 propos d'OfflineGames","\u00dcber OfflineGames","Sobre a OfflineGames","OfflineGames \u306b\u3064\u3044\u3066","OfflineGames \uc18c\uac1c","\u041e OfflineGames","Informazioni su OfflineGames","OfflineGames hakk\u0131nda"],
    "the collection":         ["la colecci\u00f3n","\u6e38\u620f\u6536\u85cf","\u904a\u6232\u6536\u85cf","\u0938\u0902\u0917\u094d\u0930\u0939","\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629","la collection","die Sammlung","a cole\u00e7\u00e3o","\u30b3\u30ec\u30af\u30b7\u30e7\u30f3","\ucef4\ub809\uc158","\u043a\u043e\u043b\u043b\u0435\u043a\u0446\u0438\u044f","la collezione","koleksiyon"],
    "Notes on every game in the vault": ["Notas sobre cada juego de la b\u00f3veda","\u6e38\u620f\u5e93\u4e2d\u6bcf\u6b3e\u6e38\u620f\u7684\u8bf4\u660e","\u904a\u6232\u5eab\u4e2d\u6bcf\u6b3e\u904a\u6232\u7684\u8aaa\u660e","\u0935\u0949\u0932\u094d\u091f \u0915\u0947 \u0939\u0930 \u0917\u0947\u092e \u092a\u0930 \u0928\u094b\u091f\u094d\u0938","\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0639\u0646 \u0643\u0644 \u0644\u0639\u0628\u0629 \u0641\u064a \u0627\u0644\u062e\u0632\u0646\u0629","Notes sur chaque jeu du coffre","Notizen zu jedem Spiel im Tresor","Notas sobre cada jogo do cofre","\u30dc\u30fc\u30eb\u30c8\u306e\u5168\u30b2\u30fc\u30e0\u306e\u30e1\u30e2","\ubcfc\ud2b8\uc758 \ubaa8\ub4e0 \uac8c\uc784 \uc18c\uac1c","\u0417\u0430\u043c\u0435\u0442\u043a\u0438 \u043e \u043a\u0430\u0436\u0434\u043e\u0439 \u0438\u0433\u0440\u0435 \u0445\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0430","Note su ogni gioco del caveau","Kasadaki her oyun hakk\u0131nda notlar"],
    "get in touch":           ["cont\u00e1ctanos","\u8054\u7cfb\u6211\u4eec","\u806f\u7d61\u6211\u5011","\u0938\u0902\u092a\u0930\u094d\u0915 \u0915\u0930\u0947\u0902","\u062a\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627","contactez-nous","melde dich","fale conosco","\u304a\u554f\u3044\u5408\u308f\u305b","\ubb38\uc758\ud558\uae30","\u0441\u0432\u044f\u0436\u0438\u0442\u0435\u0441\u044c \u0441 \u043d\u0430\u043c\u0438","scrivici","bize ula\u015f\u0131n"],
    "Contact Us":             ["Cont\u00e1ctanos","\u8054\u7cfb\u6211\u4eec","\u806f\u7d61\u6211\u5011","\u0939\u092e\u0938\u0947 \u0938\u0902\u092a\u0930\u094d\u0915 \u0915\u0930\u0947\u0902","\u0627\u062a\u0635\u0644 \u0628\u0646\u0627","Contactez-nous","Kontakt","Fale conosco","\u304a\u554f\u3044\u5408\u308f\u305b","\ubb38\uc758\ud558\uae30","\u0421\u0432\u044f\u0437\u0430\u0442\u044c\u0441\u044f \u0441 \u043d\u0430\u043c\u0438","Contattaci","Bize ula\u015f\u0131n"],
    "your data":              ["tus datos","\u4f60\u7684\u6570\u636e","\u4f60\u7684\u8cc7\u6599","\u0906\u092a\u0915\u093e \u0921\u0947\u091f\u093e","\u0628\u064a\u0627\u0646\u0627\u062a\u0643","vos donn\u00e9es","deine Daten","seus dados","\u3042\u306a\u305f\u306e\u30c7\u30fc\u30bf","\uc5ec\ub7ec\ubd84\uc758 \ub370\uc774\ud130","\u0432\u0430\u0448\u0438 \u0434\u0430\u043d\u043d\u044b\u0435","i tuoi dati","verileriniz"],
    "Privacy Policy":         ["Pol\u00edtica de privacidad","\u9690\u79c1\u653f\u7b56","\u96b1\u79c1\u653f\u7b56","\u0917\u094b\u092a\u0928\u0940\u092f\u0924\u093e \u0928\u0940\u0924\u093f","\u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629","Politique de confidentialit\u00e9","Datenschutzerkl\u00e4rung","Pol\u00edtica de privacidade","\u30d7\u30e9\u30a4\u30d0\u30b7\u30fc\u30dd\u30ea\u30b7\u30fc","\uac1c\uc778\uc815\ubcf4 \ucc98\ub9ac\ubc29\uce68","\u041f\u043e\u043b\u0438\u0442\u0438\u043a\u0430 \u043a\u043e\u043d\u0444\u0438\u0434\u0435\u043d\u0446\u0438\u0430\u043b\u044c\u043d\u043e\u0441\u0442\u0438","Informativa sulla privacy","Gizlilik politikas\u0131"],
    "the fine print":         ["la letra peque\u00f1a","\u7ec6\u5219","\u7d30\u5247","\u092c\u093e\u0930\u0940\u0915 \u0905\u0915\u094d\u0937\u0930","\u0627\u0644\u0628\u0646\u0648\u062f \u0627\u0644\u062f\u0642\u064a\u0642\u0629","les petits caract\u00e8res","das Kleingedruckte","as letras mi\u00fadas","\u7d30\u304b\u3044\u898f\u5b9a","\uc138\ubd80 \uc57d\uad00","\u043c\u0435\u043b\u043a\u0438\u0439 \u0448\u0440\u0438\u0444\u0442","le clausole","k\u00fc\u00e7\u00fck yaz\u0131lar"],
    "Terms of Use":           ["Condiciones de uso","\u4f7f\u7528\u6761\u6b3e","\u4f7f\u7528\u689d\u6b3e","\u0909\u092a\u092f\u094b\u0917 \u0915\u0940 \u0936\u0930\u094d\u0924\u0947\u0902","\u0634\u0631\u0648\u0637 \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645","Conditions d'utilisation","Nutzungsbedingungen","Termos de uso","\u5229\u7528\u898f\u7d04","\uc774\uc6a9\uc57d\uad00","\u0423\u0441\u043b\u043e\u0432\u0438\u044f \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u044f","Condizioni d'uso","Kullan\u0131m ko\u015fullar\u0131"],
    "rights and attribution": ["derechos y atribuci\u00f3n","\u7248\u6743\u4e0e\u7f72\u540d","\u7248\u6b0a\u8207\u7f72\u540d","\u0905\u0927\u093f\u0915\u093e\u0930 \u0914\u0930 \u0936\u094d\u0930\u0947\u092f","\u0627\u0644\u062d\u0642\u0648\u0642 \u0648\u0627\u0644\u0625\u0633\u0646\u0627\u062f","droits et attribution","Rechte und Nennung","direitos e cr\u00e9ditos","\u6a29\u5229\u3068\u30af\u30ec\u30b8\u30c3\u30c8","\uad8c\ub9ac \ubc0f \ucd9c\ucc98","\u043f\u0440\u0430\u0432\u0430 \u0438 \u0430\u0442\u0440\u0438\u0431\u0443\u0446\u0438\u044f","diritti e attribuzione","haklar ve atif"],
    "Credits, rights and licences": ["Cr\u00e9ditos, derechos y licencias","\u7248\u6743\u3001\u6743\u5229\u4e0e\u8bb8\u53ef","\u7248\u6b0a\u3001\u6b0a\u5229\u8207\u6388\u6b0a","\u0915\u094d\u0930\u0947\u0921\u093f\u091f, \u0905\u0927\u093f\u0915\u093e\u0930 \u0914\u0930 \u0932\u093e\u0907\u0938\u0947\u0902\u0938","\u0627\u0644\u062d\u0642\u0648\u0642 \u0648\u0627\u0644\u062a\u0631\u0627\u062e\u064a\u0635","Cr\u00e9dits, droits et licences","Credits, Rechte und Lizenzen","Cr\u00e9ditos, direitos e licen\u00e7as","\u30af\u30ec\u30b8\u30c3\u30c8\u30fb\u6a29\u5229\u30fb\u30e9\u30a4\u30bb\u30f3\u30b9","\ud06c\ub808\ub527, \uad8c\ub9ac \ubc0f \ub77c\uc774\uc120\uc2a4","\u0410\u0432\u0442\u043e\u0440\u044b, \u043f\u0440\u0430\u0432\u0430 \u0438 \u043b\u0438\u0446\u0435\u043d\u0437\u0438\u0438","Crediti, diritti e licenze","K\u00fcnye, haklar ve lisanslar"],
    "from the editor":        ["del editor","\u7f16\u8f91\u624b\u8bb0","\u7de8\u8f2f\u624b\u8a18","\u0938\u0902\u092a\u093e\u0926\u0915 \u0915\u0940 \u0913\u0930 \u0938\u0947","\u0645\u0646 \u0627\u0644\u0645\u062d\u0631\u0631","de la r\u00e9daction","von der Redaktion","do editor","\u7de8\u96c6\u90e8\u3088\u308a","\uc5d0\ub514\ud130 \ub178\ud2b8","\u043e\u0442 \u0440\u0435\u0434\u0430\u043a\u0446\u0438\u0438","dalla redazione","edit\u00f6rden"],
    "How we play games in a browser tab": ["C\u00f3mo jugamos en una pesta\u00f1a del navegador","\u6211\u4eec\u5982\u4f55\u5728\u6d4f\u89c8\u5668\u6807\u7b7e\u9875\u91cc\u73a9\u6e38\u620f","\u6211\u5011\u5982\u4f55\u5728\u700f\u89bd\u5668\u5206\u9801\u88e1\u73a9\u904a\u6232","\u0939\u092e \u092c\u094d\u0930\u093e\u0909\u091c\u093c\u0930 \u091f\u0948\u092c \u092e\u0947\u0902 \u0915\u0948\u0938\u0947 \u0916\u0947\u0932\u0924\u0947 \u0939\u0948\u0902","\u0643\u064a\u0641 \u0646\u0644\u0639\u0628 \u062f\u0627\u062e\u0644 \u062a\u0628\u0648\u064a\u0628 \u0627\u0644\u0645\u062a\u0635\u0641\u062d","Comment on joue dans un onglet de navigateur","Wie wir in einem Browser-Tab spielen","Como jogamos numa aba do navegador","\u30d6\u30e9\u30a6\u30b6\u306e\u30bf\u30d6\u3067\u904a\u3076\u65b9\u6cd5","\ube0c\ub77c\uc6b0\uc800 \ud0ed\uc5d0\uc11c \uac8c\uc784\ud558\ub294 \ubc29\ubc95","\u041a\u0430\u043a \u043c\u044b \u0438\u0433\u0440\u0430\u0435\u043c \u0432\u043e \u0432\u043a\u043b\u0430\u0434\u043a\u0435 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430","Come giochiamo in una scheda del browser","Taray\u0131c\u0131 sekmesinde nas\u0131l oynuyoruz"],
    "what's new":             ["novedades","\u6700\u65b0\u52a8\u6001","\u6700\u65b0\u52d5\u614b","\u0928\u092f\u093e \u0915\u094d\u092f\u093e \u0939\u0948","\u0645\u0627 \u0627\u0644\u062c\u062f\u064a\u062f","quoi de neuf","Neuigkeiten","novidades","\u6700\u65b0\u60c5\u5831","\uc0c8 \uc18c\uc2dd","\u0447\u0442\u043e \u043d\u043e\u0432\u043e\u0433\u043e","novit\u00e0","yenilikler"],
    "That cartridge isn't in the vault": ["Ese cartucho no est\u00e1 en la b\u00f3veda","\u6e38\u620f\u5e93\u91cc\u6ca1\u6709\u8fd9\u4e2a\u5361\u5e26","\u904a\u6232\u5eab\u88e1\u6c92\u6709\u9019\u500b\u5361\u5e36","\u0935\u0939 \u0915\u093e\u0930\u094d\u091f\u094d\u0930\u093f\u091c \u0935\u0949\u0932\u094d\u091f \u092e\u0947\u0902 \u0928\u0939\u0940\u0902 \u0939\u0948","\u0647\u0630\u0647 \u0627\u0644\u062e\u0631\u0637\u0648\u0634\u0629 \u0644\u064a\u0633\u062a \u0641\u064a \u0627\u0644\u062e\u0632\u0646\u0629","Cette cartouche n'est pas dans le coffre","Dieses Modul ist nicht im Tresor","Esse cartucho n\u00e3o est\u00e1 no cofre","\u305d\u306e\u30ab\u30fc\u30c8\u30ea\u30c3\u30b8\u306f\u30dc\u30fc\u30eb\u30c8\u306b\u3042\u308a\u307e\u305b\u3093","\uadf8 \uce74\ud2b8\ub9ac\uc9c0\ub294 \ubcfc\ud2b8\uc5d0 \uc5c6\uc2b5\ub2c8\ub2e4","\u042d\u0442\u043e\u0433\u043e \u043a\u0430\u0440\u0442\u0440\u0438\u0434\u0436\u0430 \u043d\u0435\u0442 \u0432 \u0445\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435","Quella cartuccia non \u00e8 nel caveau","O kartu\u015f kasada yok"],

    /* --- newly covered: contact panel & static pages UI -------------------- */
    "Send us a message": ["Env\u00edanos un mensaje","给我们发消息","傳訊息給我們","हमें संदेश भेजें","أرسل لنا رسالة","Envoyez-nous un message","Schick uns eine Nachricht","Envie-nos uma mensagem","メッセージを送る","메시지를 보내주세요","Отправьте нам сообщение","Inviaci un messaggio","Bize mesaj gönder"],
    "Feedback about a game": ["Comentarios sobre un juego","关于游戏的反馈","關於遊戲的回饋","किसी गेम के बारे में प्रतिक्रिया","ملاحظات حول لعبة","Retour sur un jeu","Feedback zu einem Spiel","Feedback sobre um jogo","ゲームについてのフィードバック","게임에 대한 피드백","Отзыв об игре","Feedback su un gioco","Bir oyun hakkında geri bildirim"],
    "Feedback about OfflineGames": ["Comentarios sobre OfflineGames","关于 OfflineGames 的反馈","關於 OfflineGames 的回饋","OfflineGames के बारे में प्रतिक्रिया","ملاحظات حول OfflineGames","Retour sur OfflineGames","Feedback zu OfflineGames","Feedback sobre o OfflineGames","OfflineGames についてのフィードバック","OfflineGames에 대한 피드백","Отзыв об OfflineGames","Feedback su OfflineGames","OfflineGames hakkında geri bildirim"],
    "Suggest a game": ["Sugerir un juego","推荐游戏","推薦遊戲","गेम सुझाएँ","اقتراح لعبة","Sugg\u00e9rer un jeu","Spiel vorschlagen","Sugerir um jogo","ゲームを提案する","게임 추천하기","Предложить игру","Suggerisci un gioco","Oyun öner"],
    "Business inquiries": ["Consultas comerciales","商务合作","商務合作","व्यावसायिक पूछताछ","استفسارات تجارية","Demandes commerciales","Gesch\u00e4ftsanfragen","Consultas comerciais","ビジネスに関するお問い合わせ","비즈니스 문의","Деловые запросы","Richieste commerciali","İş başvuruları"],
    "Other": ["Otro","其他","其他","अन्य","أخرى","Autre","Sonstiges","Outro","その他","기타","Другое","Altro","Diğer"],
    "Documentation": ["Documentaci\u00f3n","文档","文件","दस्तावेज़","التوثيق","Documentation","Dokumentation","Documenta\u00e7\u00e3o","ドキュメント","문서","Документация","Documentazione","Dok\u00fcmantasyon"],
    "How the vault works": ["C\u00f3mo funciona la b\u00f3veda","游戏库如何运作","遊戲庫如何運作","वॉल्ट कैसे काम करता है","كيف تعمل الخزنة","Comment fonctionne le coffre","Wie der Tresor funktioniert","Como o cofre funciona","ボールトの仕組み","보관함 작동 방식","Как работает хранилище","Come funziona il caveau","Kasa nasıl çalışır"],
    "Feedback": ["Comentarios","反馈","回饋","प्रतिक्रिया","ملاحظات","Retours","Feedback","Feedback","フィードバック","피드백","Отзывы","Feedback","Geri bildirim"],
    "Select a game": ["Selecciona un juego","选择一个游戏","選擇一個遊戲","एक गेम चुनें","اختر لعبة","S\u00e9lectionnez un jeu","Spiel ausw\u00e4hlen","Selecione um jogo","ゲームを選択","게임 선택","Выберите игру","Seleziona un gioco","Bir oyun seç"],
    "Search games and categories": ["Buscar juegos y categor\u00edas","搜索游戏和分类","搜尋遊戲和分類","गेम और श्रेणियाँ खोजें","ابحث عن الألعاب والفئات","Rechercher jeux et cat\u00e9gories","Spiele und Kategorien suchen","Pesquisar jogos e categorias","ゲームとカテゴリを検索","게임 및 카테고리 검색","Поиск игр и категорий","Cerca giochi e categorie","Oyun ve kategorileri ara"],
    "Recently played": ["Jugados recientemente","最近游玩","最近遊玩","हाल ही में खेले गए","تم لعبها مؤخرًا","Jou\u00e9s r\u00e9cemment","Zuletzt gespielt","Jogados recentemente","最近プレイしたゲーム","최근 플레이한 게임","Недавно сыгранные","Giocati di recente","Son oynananlar"],
    "Which game?": ["\u00bfQu\u00e9 juego?","哪个游戏？","哪個遊戲？","कौन सा गेम?","أي لعبة؟","Quel jeu ?","Welches Spiel?","Qual jogo?","どのゲーム？","어떤 게임인가요?","Какая игра?","Quale gioco?","Hangi oyun?"],
    "Game name": ["Nombre del juego","游戏名称","遊戲名稱","गेम का नाम","اسم اللعبة","Nom du jeu","Spielname","Nome do jogo","ゲーム名","게임 이름","Название игры","Nome del gioco","Oyun adı"],
    "Select an option": ["Selecciona una opci\u00f3n","选择一个选项","選擇一個選項","एक विकल्प चुनें","اختر خيارًا","S\u00e9lectionnez une option","Option w\u00e4hlen","Selecione uma op\u00e7\u00e3o","オプションを選択","옵션을 선택하세요","Выберите вариант","Seleziona un'opzione","Bir seçenek belirleyin"],
    "A game won't load": ["Un juego no carga","游戏无法加载","遊戲無法載入","गेम लोड नहीं हो रहा","اللعبة لا تُحمّل","Un jeu ne se charge pas","Ein Spiel l\u00e4dt nicht","Um jogo n\u00e3o carrega","ゲームが読み込まれない","게임이 로드되지 않아요","Игра не загружается","Un gioco non si carica","Oyun yüklenmiyor"],
    "A game is broken mid-play": ["Un juego falla a mitad de partida","游戏中途出错","遊戲中途出錯","गेम बीच में टूट गया","اللعبة تتعطل أثناء اللعب","Un jeu plante en cours de partie","Ein Spiel st\u00fcrzt mitten im Spiel ab","Um jogo quebra no meio da partida","プレイ中にゲームが壊れる","게임이 플레이 중에 고장나요","Игра ломается во время игры","Un gioco si blocca durante la partita","Oyun oynarken bozuluyor"],
    "Controls don't work on my device": ["Los controles no funcionan en mi dispositivo","我的设备上操作失灵","我的裝置上操作失靈","मेरे डिवाइस पर नियंत्रण काम नहीं कर रहे","عناصر التحكم لا تعمل على جهازي","Les commandes ne fonctionnent pas sur mon appareil","Steuerung funktioniert auf meinem Ger\u00e4t nicht","Os controles n\u00e3o funcionam no meu dispositivo","自分のデバイスで操作が効かない","내 기기에서 조작이 안 돼요","Управление не работает на моём устройстве","I controlli non funzionano sul mio dispositivo","Kontroller cihazımda çalışmıyor"],
    "Something looks wrong on the page": ["Algo se ve mal en la p\u00e1gina","页面显示异常","頁面顯示異常","पेज पर कुछ गड़बड़ दिख रहा है","هناك شيء خاطئ في الصفحة","Quelque chose cloche sur la page","Auf der Seite stimmt etwas nicht","Algo parece errado na p\u00e1gina","ページの表示がおかしい","페이지에 뭔가 이상해요","Что-то не так на странице","Qualcosa non va nella pagina","Sayfada bir şey bozuk görünüyor"],
    "The site is slow": ["El sitio va lento","网站很慢","網站很慢","साइट धीमी है","الموقع بطيء","Le site est lent","Die Seite ist langsam","O site est\u00e1 lento","サイトが重い","사이트가 느려요","Сайт медленный","Il sito \u00e8 lento","Site yavaş"],
    "Copyright / takedown request": ["Solicitud de derechos / retirada","版权/下架请求","版權/下架請求","कॉपीराइट / हटाने का अनुरोध","طلب حقوق / إزالة","Demande de droits / retrait","Urheberrecht / L\u00f6schantrag","Pedido de direitos / remo\u00e7\u00e3o","著作権/削除リクエスト","저작권/삭제 요청","Запрос на авторские права / удаление","Richiesta copyright / rimozione","Telif hakkı / kaldırma talebi"],
    "Something else": ["Otra cosa","其他","其他","कुछ और","شيء آخر","Autre chose","Etwas anderes","Outra coisa","その他","기타","Что-то ещё","Altro","Başka bir şey"],
    "Your email (optional)": ["Tu correo (opcional)","你的邮箱（可选）","你的信箱（選填）","आपका ईमेल (वैकल्पिक)","بريدك الإلكتروني (اختياري)","Votre e-mail (facultatif)","Deine E-Mail (optional)","Seu e-mail (opcional)","メールアドレス（任意）","이메일 (선택 사항)","Ваша почта (необязательно)","La tua email (facoltativa)","E-postanız (isteğe bağlı)"],
    "So we can reply": ["Para poder responderte","以便我们回复","以便我們回覆","ताकि हम जवाब दे सकें","حتى نتمكن من الرد","Pour que nous puissions r\u00e9pondre","Damit wir antworten k\u00f6nnen","Para podermos responder","返信できるように","답장할 수 있도록","Чтобы мы могли ответить","Cos\u00ec possiamo rispondere","Yanıt verebilmemiz için"],
    "Send feedback": ["Enviar comentarios","发送反馈","傳送回饋","प्रतिक्रिया भेजें","إرسال ملاحظات","Envoyer un retour","Feedback senden","Enviar feedback","フィードバックを送信","피드백 보내기","Отправить отзыв","Invia feedback","Geri bildirim gönder"],
    "Send message": ["Enviar mensaje","发送消息","傳送訊息","संदेश भेजें","إرسال رسالة","Envoyer le message","Nachricht senden","Enviar mensagem","メッセージを送信","메시지 보내기","Отправить сообщение","Invia messaggio","Mesaj gönder"],
    "Send your message": ["Env\u00eda tu mensaje","发送你的消息","傳送你的訊息","अपना संदेश भेजें","أرسل رسالتك","Envoyez votre message","Sende deine Nachricht","Envie sua mensagem","メッセージを送信する","메시지를 보내세요","Отправьте сообщение","Invia il tuo messaggio","Mesajını gönder"],
    "Copy the message": ["Copiar el mensaje","复制消息","複製訊息","संदेश कॉपी करें","انسخ الرسالة","Copier le message","Nachricht kopieren","Copiar a mensagem","メッセージをコピー","메시지 복사","Скопировать сообщение","Copia il messaggio","Mesajı kopyala"],
    "Then paste it into your email": ["Luego p\u00e9galo en tu correo","然后粘贴到你的邮箱","然後貼到你的信箱","फिर इसे अपने ईमेल में पेस्ट करें","ثم الصقه في بريدك","Collez-le ensuite dans votre e-mail","Dann in deine E-Mail einf\u00fcgen","Depois cole no seu e-mail","それをメールに貼り付け","그런 다음 이메일에 붙여넣기","Затем вставьте в почту","Poi incollalo nella tua email","Sonra e-postana yapıştır"],
    "Copied \u2713": ["Copiado \u2713","已复制 \u2713","已複製 \u2713","कॉपी हो गया \u2713","تم النسخ \u2713","Copi\u00e9 \u2713","Kopiert \u2713","Copiado \u2713","コピーしました \u2713","복사됨 \u2713","Скопировано \u2713","Copiato \u2713","Kopyalandı \u2713"],
    "Address and message are on your clipboard": ["Direcci\u00f3n y mensaje est\u00e1n en tu portapapeles","地址和消息已在剪贴板","地址和訊息已在剪貼簿","पता और संदेश क्लिपबोर्ड पर हैं","العنوان والرسالة في الحافظة","Adresse et message sont dans le presse-papiers","Adresse und Nachricht sind in der Zwischenablage","Endere\u00e7o e mensagem est\u00e3o na \u00e1rea de transfer\u00eancia","アドレスとメッセージをクリップボードにコピーしました","주소와 메시지가 클립보드에 있습니다","Адрес и сообщение в буфере обмена","Indirizzo e messaggio negli appunti","Adres ve mesaj panoda"],
    "Open my mail app": ["Abrir mi app de correo","打开我的邮箱应用","開啟我的信箱應用程式","मेरा मेल ऐप खोलें","افتح تطبيق البريد","Ouvrir mon app mail","Meine Mail-App \u00f6ffnen","Abrir meu app de e-mail","メールアプリを開く","내 메일 앱 열기","Открыть моё почтовое приложение","Apri la mia app di posta","Mail uygulamamı aç"],
    "Uses this device's default email program": ["Usa el programa de correo por defecto de este dispositivo","使用此设备的默认邮件程序","使用此裝置的預設郵件程式","इस डिवाइस के डिफ़ॉल्ट ईमेल प्रोग्राम का उपयोग करता है","يستخدم برنامج البريد الافتراضي لهذا الجهاز","Utilise le programme mail par d\u00e9faut de cet appareil","Nutzt das Standard-Mailprogramm dieses Ger\u00e4ts","Usa o programa de e-mail padr\u00e3o deste dispositivo","このデバイスのデフォルトのメールプログラムを使用","이 기기의 기본 메일 프로그램 사용","Использует почтовую программу по умолчанию этого устройства","Usa il programma email predefinito di questo dispositivo","Bu cihazın varsayılan e-posta programını kullanır"],
    "Done": ["Listo","完成","完成","हो गया","تم","Termin\u00e9","Fertig","Conclu\u00eddo","完了","완료","Готово","Fatto","Bitti"],
    "The page you asked for doesn't exist \u2014 it may have been renamed, or the link may be mistyped.": ["La p\u00e1gina que buscas no existe: puede que haya cambiado de nombre o que el enlace est\u00e9 mal escrito.","你请求的页面不存在——可能已重命名，或链接输入有误。","你請求的頁面不存在——可能已重新命名，或連結輸入有誤。","आपने जो पेज माँगा वह मौजूद नहीं है — हो सकता है उसका नाम बदला गया हो या लिंक गलत टाइप हुआ हो।","الصفحة التي طلبتها غير موجودة — قد تكون أعيدت تسميتها أو الرابط مكتوب بشكل خاطئ.","La page demand\u00e9e n'existe pas — elle a peut-\u00eatre \u00e9t\u00e9 renomm\u00e9e ou le lien est mal saisi.","Die angeforderte Seite existiert nicht — sie wurde vielleicht umbenannt oder der Link ist falsch.","A p\u00e1gina solicitada n\u00e3o existe — pode ter sido renomeada ou o link est\u00e1 errado.","リクエストされたページは存在しません — 名前が変更されたか、リンクが間違っている可能性があります。","요청하신 페이지가 존재하지 않습니다 — 이름이 바뀌었거나 링크가 잘못되었을 수 있습니다.","Запрошенной страницы не существует — возможно, её переименовали или ссылка набрана неверно.","La pagina richiesta non esiste — potrebbe essere stata rinominata o il link \u00e8 sbagliato.","İstediğiniz sayfa mevcut değil — yeniden adlandırılmış veya bağlantı yanlış yazılmış olabilir."],
    "Open the vault": ["Abrir la b\u00f3veda","打开游戏库","開啟遊戲庫","वॉल्ट खोलें","افتح الخزنة","Ouvrir le coffre","Tresor \u00f6ffnen","Abrir o cofre","ボールトを開く","보관함 열기","Открыть хранилище","Apri il caveau","Kasayı aç"],
    "notes on every game": ["notas sobre cada juego","每款游戏的说明","每款遊戲的說明","हर गेम पर नोट्स","ملاحظات عن كل لعبة","notes sur chaque jeu","Notizen zu jedem Spiel","notas sobre cada jogo","全ゲームの解説","모든 게임 노트","заметки о каждой игре","note su ogni gioco","her oyun hakkında notlar"],
    "guide": ["gu\u00eda","指南","指南","गाइड","دليل","guide","Anleitung","guia","ガイド","가이드","гайд","guida","rehber"],
    "tell us what broke": ["dinos qu\u00e9 se rompi\u00f3","告诉我们哪里坏了","告訴我們哪裡壞了","हमें बताएँ क्या टूटा","أخبرنا ما الذي تعطل","dites-nous ce qui s'est cass\u00e9","sag uns, was kaputt ist","diga-nos o que quebrou","何が壊れたか教えて","무엇이 고장났는지 알려주세요","скажите, что сломалось","dicci cosa si \u00e8 rotto","neyin bozulduğunu söyle"],
    "Questions, feedback, game submissions, or bug reports \u2014 send them our way and we'll get back to you.": ["Preguntas, comentarios, env\u00edos de juegos o reportes de errores: env\u00edanoslos y te responderemos.","问题、反馈、游戏投稿或错误报告——发给我们，我们会回复你。","問題、回饋、遊戲投稿或錯誤回報——傳給我們，我們會回覆你。","सवाल, प्रतिक्रिया, गेम सबमिशन या बग रिपोर्ट — हमें भेजें, हम जवाब देंगे।","أسئلة أو ملاحظات أو اقتراح ألعاب أو بلاغات أخطاء — أرسلها لنا وسنرد عليك.","Questions, retours, propositions de jeux ou rapports de bugs — envoyez-les nous, on vous r\u00e9pondra.","Fragen, Feedback, Spieleinsendungen oder Fehlermeldungen — schick sie uns, wir melden uns.","Perguntas, feedback, envio de jogos ou relat\u00f3rios de bugs — mande para n\u00f3s e responderemos.","質問、フィードバック、ゲーム投稿、バグ報告 — 送ってください、返信します。","질문, 피드백, 게임 제보 또는 버그 신고 — 보내주시면 답변드리겠습니다.","Вопросы, отзывы, предложения игр или сообщения об ошибках — присылайте, мы ответим.","Domande, feedback, proposte di giochi o segnalazioni di bug — inviaci tutto, ti risponderemo.","Sorular, geri bildirimler, oyun önerileri veya hata raporları — bize gönderin, dönüş yapacağız."],
    "Open the contact form": ["Abrir el formulario de contacto","打开联系表单","開啟聯絡表單","संपर्क फॉर्म खोलें","افتح نموذج الاتصال","Ouvrir le formulaire de contact","Kontaktformular \u00f6ffnen","Abrir o formul\u00e1rio de contato","お問い合わせフォームを開く","문의 양식 열기","Открыть форму связи","Apri il modulo di contatto","İletişim formunu aç"],
    "Prefer to browse first?": ["\u00bfPrefieres explorar primero?","想先浏览一下？","想先瀏覽一下？","पहले ब्राउज़ करना चाहते हैं?","تفضل التصفح أولاً؟","Pr\u00e9f\u00e9rez-vous parcourir d'abord ?","Lieber erst st\u00f6bern?","Prefere navegar primeiro?","まずは閲覧しますか？","먼저 둘러보시겠어요?","Хотите сначала посмотреть?","Preferisci dare un'occhiata prima?","Önce göz atmak ister misin?"],
    "Learn more about OfflineGames": ["Conoce m\u00e1s sobre OfflineGames","了解更多关于 OfflineGames","了解更多關於 OfflineGames","OfflineGames के बारे में और जानें","اعرف المزيد عن OfflineGames","En savoir plus sur OfflineGames","Mehr \u00fcber OfflineGames erfahren","Saiba mais sobre o OfflineGames","OfflineGames についてもっと知る","OfflineGames에 대해 더 알아보기","Узнайте больше об OfflineGames","Scopri di pi\u00f9 su OfflineGames","OfflineGames hakkında daha fazla bilgi edin"],
    "vault": ["b\u00f3veda","游戏库","遊戲庫","वॉल्ट","الخزنة","coffre","Tresor","cofre","ボールト","보관함","хранилище","caveau","kasa"],
    "About OfflineGames": ["Acerca de OfflineGames","关于 OfflineGames","關於 OfflineGames","OfflineGames के बारे में","حول OfflineGames","À propos d'OfflineGames","Über OfflineGames","Sobre o OfflineGames","OfflineGames について","OfflineGames 소개","О OfflineGames","Informazioni su OfflineGames","OfflineGames hakkında"],

    /* --- generic UI fallbacks -------------------------------------------- */
    "404": ["404","404","404","404","404","404","404","404","404","404","404","404","404"],
    "What we collect": ["Qu\u00e9 recopilamos","我们收集什么","我們收集什麼","हम क्या एकत्र करते हैं","ما الذي نجمعه","Ce que nous collectons","Was wir sammeln","O que coletamos","収集する情報","수집하는 정보","Что мы собираем","Cosa raccogliamo","Ne topluyoruz"],
    "Privacy Policy": ["Pol\u00edtica de privacidad","隐私政策","隱私政策","गोपनीयता नीति","سياسة الخصوصية","Politique de confidentialit\u00e9","Datenschutz","Pol\u00edtica de privacidade","プライバシーポリシー","개인정보처리방침","Политика конфиденциальности","Informativa sulla privacy","Gizlilik Politikası"],
    "Terms of Use": ["T\u00e9rminos de uso","使用条款","使用條款","उपयोग की शर्तें","شروط الاستخدام","Conditions d'utilisation","Nutzungsbedingungen","Termos de uso","利用規約","이용약관","Условия использования","Condizioni d'uso","Kullanım Koşulları"],
    "Credits, rights and licences": ["Cr\u00e9ditos, derechos y licencias","版权、权利与许可","版權、權利與授權","क्रेडिट, अधिकार और लाइसेंस","الحقوق والتراخيص","Cr\u00e9dits, droits et licences","Credits, Rechte und Lizenzen","Cr\u00e9ditos, direitos e licen\u00e7as","クレジット・権利・ライセンス","크레딧, 권리 및 라이선스","Авторы, права и лицензии","Crediti, diritti e licenze","Künye, haklar ve lisanslar"]
  };

  /* --------------------------------------------------------------------------
     Where translation is allowed to touch. Now includes static prose, cards,
     contact panel, footer, about strip, etc. Anything outside this list is
     still left alone (code, pre, etc. are filtered in the walker).
     -------------------------------------------------------------------------- */
  var SEL = [
    ".top-nav a", ".top a", ".top button",
    ".sb a", ".sb button", ".sb-text", ".sb-label",
    ".search-wrap input",
    ".hero .eyebrow", ".hero h1 span", ".hero .lead", ".hero .btn",
    ".spotlight .eyebrow",
    ".cat-btn", ".cat-card .full", ".cat-card .short", "#show-all",
    ".empty h2", ".news > h2",
    ".about-strip .eyebrow", ".about-strip h2", ".about-links a", ".about-strip p",
    ".site-foot a", ".site-foot p",
    ".picker .btn",
    ".badge", ".cart-more",
    ".page > .back", ".page > .eyebrow", ".page > h1",
    ".page p", ".page h2", ".page h3", ".page li", ".page a",
    ".lib-card .eyebrow", ".card[data-title] .eyebrow", ".card .eyebrow",
    ".cart-desc", ".cart-meta .badge",
    ".news-card h3", ".news-card p",
    "#news-open-title", "#news-open-body",
    ".lib-card h2", ".lib-card p",
    "#picker-meta",
    ".prose p", ".prose h2", ".prose h3", ".prose li", ".prose th", ".prose td", ".prose a", ".prose strong", ".prose em", ".prose span",
    ".card p", ".card h2", ".card h3", ".card li", ".card a", ".card strong",
    ".cx-label", ".cx-head h2", ".cx-head p", ".cx-txt", ".cx-cap", ".cx-note",
    ".cx-search", ".cx-input", ".cx-textarea",
    ".cx-primary-action b", ".cx-primary-action em",
    ".cx-send", ".cx-row", ".cx-game", ".cx-game span", ".cx-game em",
    ".btn"
  ].join(",");

  var ATTR = ["placeholder", "aria-label", "title", "data-label"];

  // Cache: normalised English -> row of 13 translations.
  var MAP = {}, MAP_CI = {};
  function norm(s) { return String(s).replace(/\s+/g, " ").trim(); }
  function load(dict) {
    for (var k in dict) {
      if (!dict.hasOwnProperty(k)) continue;
      var row = dict[k];
      if (!row || row.length !== LANGS.length - 1) continue;
      MAP[norm(k)] = row;
      MAP_CI[norm(k).toLowerCase()] = row;
    }
  }
  load(STR);
  if (window.OG_TEXT) load(window.OG_TEXT);

  var idx = 0;
  function lookup(text) {
    if (idx === 0) return null;
    var key = norm(text);
    var row = MAP[key] || MAP_CI[key.toLowerCase()];
    if (!row) return null;
    var out = row[idx - 1];
    return out || null;
  }

  function swapTextNode(node) {
    var raw = node.nodeValue;
    var trimmed = norm(raw);
    if (!trimmed) return;
    if (!node.__en) node.__en = trimmed;
    var out = idx === 0 ? node.__en : (lookup(node.__en) || node.__en);
    var lead = raw.match(/^\s*/)[0], tail = raw.match(/\s*$/)[0];
    if (node.nodeValue !== lead + out + tail) node.nodeValue = lead + out + tail;
  }

  function swapAttrs(el) {
    for (var i = 0; i < ATTR.length; i++) {
      var a = ATTR[i];
      if (!el.hasAttribute(a)) continue;
      var store = "__en_" + a;
      if (!el[store]) el[store] = norm(el.getAttribute(a));
      var out = idx === 0 ? el[store] : (lookup(el[store]) || el[store]);
      if (el.getAttribute(a) !== out) el.setAttribute(a, out);
    }
  }

  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  var BLOCK_SEL = ".prose p, .page p, .prose li, .page li, .prose h2, .page h2, .prose h3, .page h3, .card p";
  function translateBlocks(){
    try{
      var blocks = document.querySelectorAll(BLOCK_SEL);
      for(var i=0;i<blocks.length;i++){
        var el = blocks[i];
        if(el.querySelector('code, pre')) continue;
        var full = norm(el.textContent);
        if(!full) continue;
        if(!el.__en_full){
          el.__en_full = full;
          el.__en_html = el.innerHTML;
          el.__en_links = [];
          var as = el.querySelectorAll('a');
          for(var j=0;j<as.length;j++){
            el.__en_links.push({href: as[j].getAttribute('href'), text: norm(as[j].textContent), target: as[j].getAttribute('target'), rel: as[j].getAttribute('rel')});
          }
        }
        if(idx===0){
          if(el.innerHTML !== el.__en_html) el.innerHTML = el.__en_html;
          continue;
        }
        var trans = lookup(el.__en_full);
        if(!trans) continue;
        if(!el.__en_links || el.__en_links.length===0){
          if(norm(el.textContent) !== trans) el.textContent = trans;
          continue;
        }
        var html = escapeHtml(trans);
        for(var k=0;k<el.__en_links.length;k++){
          var li = el.__en_links[k];
          var origTxt = li.text;
          var transLinkTxt = lookup(origTxt) || origTxt;
          var escTransLink = escapeHtml(transLinkTxt);
          var escOrig = escapeHtml(origTxt);
          var attrs = ' href="'+ (li.href||'#') +'"';
          if(li.target) attrs+=' target="'+escapeHtml(li.target)+'"';
          if(li.rel) attrs+=' rel="'+escapeHtml(li.rel)+'"';
          if(html.indexOf(escTransLink) !== -1){
            html = html.replace(escTransLink, '<a'+attrs+'>'+escTransLink+'</a>');
          } else if(html.indexOf(escOrig) !== -1){
            html = html.replace(escOrig, '<a'+attrs+'>'+escTransLink+'</a>');
          }
        }
        if(el.innerHTML !== html) el.innerHTML = html;
      }
    }catch(e){}
  }

  var busy = false;
  function apply(root) {
    busy = true;
    var scope = root || document;

    try {
      var els = scope.querySelectorAll ? scope.querySelectorAll(SEL) : document.querySelectorAll(SEL);
      for (var i = 0; i < els.length; i++) swapAttrs(els[i]);
    } catch(e){}

    var extra = document.querySelectorAll(".sb-toggle, .sb-close, .sb-burger, #og-sb");
    for (var j = 0; j < extra.length; j++) swapAttrs(extra[j]);

    try{ translateBlocks(); }catch(e){}

    try {
      var bodyRoot = scope.body || document.body || scope;
      var walker = document.createTreeWalker(bodyRoot, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
          if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
          if (!norm(node.nodeValue)) return NodeFilter.FILTER_REJECT;
          var parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          var tag = parent.tagName ? parent.tagName.toLowerCase() : "";
          if (tag === "script" || tag === "style" || tag === "noscript" || tag === "code" || tag === "pre" || tag === "iframe") return NodeFilter.FILTER_REJECT;
          if (parent.closest && parent.closest("code, pre, script, style, noscript, a")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var toTranslate = [];
      var n;
      while ((n = walker.nextNode())) toTranslate.push(n);
      for (var k = 0; k < toTranslate.length; k++) swapTextNode(toTranslate[k]);
    } catch(e){}

    setTimeout(function () { busy = false; }, 0);
  }

  /* --------------------------------------------------------------------------
     The dropdown
     -------------------------------------------------------------------------- */
  var current = null, list = null, btn = null, label = null;

  function buildUI() {
    var sb = document.getElementById("og-sb");
    var wrap = document.createElement("div");
    wrap.className = "lang-wrap";

    if (sb) {
      var foot = document.createElement("div");
      foot.className = "sb-foot";
      foot.appendChild(wrap);
      sb.appendChild(foot);
    } else {
      wrap.classList.add("lang-float");
      document.body.appendChild(wrap);
    }

    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lang-btn";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML =
      '<svg class="sb-ico" viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.3 3.3 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.3-5.3-3.3-8.5S9.8 5.9 12 3.5z"/>' +
      "</svg>" +
      '<span class="sb-text lang-name"></span>' +
      '<svg class="lang-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>';
    label = btn.querySelector(".lang-name");

    list = document.createElement("div");
    list.className = "lang-list";
    list.setAttribute("role", "listbox");
    list.hidden = true;
    LANGS.forEach(function (L, i) {
      var o = document.createElement("button");
      o.type = "button";
      o.className = "lang-opt";
      o.setAttribute("role", "option");
      o.setAttribute("lang", L.c);
      o.dir = L.rtl ? "rtl" : "ltr";
      o.textContent = L.n;
      o.addEventListener("click", function () { setLang(L.c, true); closeList(); btn.focus(); });
      list.appendChild(o);
    });

    wrap.appendChild(btn);
    wrap.appendChild(list);

    btn.addEventListener("click", function () { list.hidden ? openList() : closeList(); });
    document.addEventListener("click", function (e) {
      if (!list.hidden && !wrap.contains(e.target)) closeList();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !list.hidden) { closeList(); btn.focus(); }
    });
  }

  function openList() {
    list.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    var r = btn.getBoundingClientRect();
    list.classList.toggle("up", window.innerHeight - r.bottom < Math.min(360, LANGS.length * 40));
    var sel = list.querySelector(".lang-opt.on");
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: "nearest" });
  }
  function closeList() {
    list.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }

  /* --------------------------------------------------------------------------
     Switching
     -------------------------------------------------------------------------- */
  function setLang(code, save) {
    var i = 0;
    for (var n = 0; n < LANGS.length; n++) if (LANGS[n].c === code) i = n;
    idx = i;
    current = LANGS[i];

    document.documentElement.lang = current.c;
    document.documentElement.dir = current.rtl ? "rtl" : "ltr";
    document.documentElement.classList.toggle("rtl", !!current.rtl);

    if (label) label.textContent = current.n;
    if (btn) btn.setAttribute("aria-label", (lookup("Language") || "Language") + ": " + current.n);
    if (list) {
      [].forEach.call(list.children, function (o, n) {
        var on = n === i;
        o.classList.toggle("on", on);
        o.setAttribute("aria-selected", String(on));
      });
    }

    apply(document);
    if (save) { try { localStorage.setItem(KEY, current.c); } catch (e) {} }
  }

  function firstChoice() {
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (saved) {
      for (var i = 0; i < LANGS.length; i++) if (LANGS[i].c === saved) return saved;
    }
    var want = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
    want = want.toLowerCase();
    if (want.indexOf("zh") === 0) {
      return /(tw|hk|mo|hant)/.test(want) ? "zh-TW" : "zh-CN";
    }
    var base = want.split("-")[0];
    for (var j = 0; j < LANGS.length; j++) if (LANGS[j].c === base) return base;
    return "en";
  }

  function start() {
    buildUI();
    setLang(firstChoice(), false);

    if ("MutationObserver" in window) {
      var mo = new MutationObserver(function (muts) {
        if (busy) return;
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          if (m.type === "characterData" || m.addedNodes.length) {
            apply(document);
            return;
          }
        }
      });
      ["game-grid", "news-grid", "cat-grid", "cat-heading", "picker", "news-open", "news-list", "lib-static", "lib-extra"]
        .forEach(function (id) {
          var el = document.getElementById(id);
          if (el) mo.observe(el, { childList: true, subtree: true, characterData: true });
        });
      // Watch the whole body for contact panel and static prose that appears after fx-reveal
      try {
        mo.observe(document.body, { childList: true, subtree: true, characterData: true });
      } catch(e){}
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  window.OGLang = {
    set: function (c) { setLang(c, true); },
    get: function () { return current && current.c; },
    list: LANGS
  };
})();
