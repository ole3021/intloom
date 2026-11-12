import { z } from "zod";
import type { Condition } from "./weather.ts";

export const languageSchema = z.enum([
  "en",
  "zh-Hans",
  "zh-Hant",
  "ja",
  "ko",
  "es",
  "fr",
  "de",
  "pt",
  "ar",
]);
export type Language = z.infer<typeof languageSchema>;

export function selectLanguage(tag: string): Language {
  const locale = new Intl.Locale(tag);
  if (locale.language === "zh")
    return locale.maximize().script === "Hant" ? "zh-Hant" : "zh-Hans";
  return languageSchema.safeParse(locale.language).data ?? "en";
}

export const messages = {
  en: {
    question: "What should I call you? A nickname is fine.",
    greeting: "Hello, {name}!",
    source:
      "Location estimated from the network connection. Weather from wttr.in.",
    timeZone: "System time zone",
    madeCard:
      "This Loom made a greeting card with your name and the weather near you.",
    offlineCard:
      "This Loom made a greeting card with your name. The local weather is unavailable.",
    how: "IntLoom runs the Looms you install, pauses when it needs your input, and saves the result so you can open it again.",
    next: "Want to try another Loom?",
    tryMeeting:
      "Turn a short meeting record into minutes you can share with meeting-notes.",
    install: "Install",
    run: "Before your first run, configure a model that supports structured output as shown in the tutorial. Then try this example.",
    sample:
      "We agreed to roll out to 10% of users. Lin will share the test results on Thursday. The launch date is still open.",
    tutorial: "View the full tutorial",
    weather: {
      clear: "Clear",
      partlyCloudy: "Partly cloudy",
      cloudy: "Cloudy",
      overcast: "Overcast",
      fog: "Fog or mist",
      haze: "Haze or smoke",
      dust: "Dust or sand",
      rain: "Rain",
      snow: "Snow",
      ice: "Icy precipitation",
      thunder: "Thunder",
    },
  },
  "zh-Hans": {
    question: "我该怎么称呼你？昵称也可以。",
    greeting: "你好，{name}！",
    source: "地点按运行设备的网络出口估算，天气来自 wttr.in。",
    timeZone: "系统时区",
    madeCard: "这个 Loom 用你的称呼和附近的天气做了一张问候卡。",
    offlineCard: "这个 Loom 用你的称呼做了一张问候卡，本次未能取得附近天气。",
    how: "IntLoom 负责运行你安装的 Loom，在需要时停下来等你回答，然后接着执行，把结果保存下来供你再次打开。",
    next: "想试试其他 Loom？",
    tryMeeting: "试试 meeting-notes，把一段会议记录整理成可以分享的纪要。",
    install: "安装",
    run: "首次使用 meeting-notes，先按教程配置支持结构化输出的模型。然后试着运行下面的命令。",
    sample:
      "我们决定先向 10% 的用户开放新功能。小林周四提交测试结果，上线日期待定。",
    tutorial: "查看详细教程",
    weather: {
      clear: "晴",
      partlyCloudy: "局部多云",
      cloudy: "多云",
      overcast: "阴",
      fog: "雾",
      haze: "霾或烟雾",
      dust: "沙尘",
      rain: "雨",
      snow: "雪",
      ice: "冻雨或冰粒等降水",
      thunder: "雷雨",
    },
  },
  "zh-Hant": {
    question: "該怎麼稱呼你？暱稱也可以。",
    greeting: "你好，{name}！",
    source: "地點依執行裝置的網路出口估算，天氣資料來自 wttr.in。",
    timeZone: "系統時區",
    madeCard: "這個 Loom 用你的稱呼和附近的天氣做了一張問候卡。",
    offlineCard: "這個 Loom 用你的稱呼做了一張問候卡，這次未能取得附近天氣。",
    how: "IntLoom 會執行你安裝的 Loom，需要你提供資料時會暫停，等你回答後繼續，並儲存結果供你再次開啟。",
    next: "想試試其他 Loom 嗎？",
    tryMeeting: "試試 meeting-notes，把一段會議記錄整理成可以分享的會議摘要。",
    install: "安裝",
    run: "首次使用 meeting-notes，請先依教學設定支援結構化輸出的模型，再試著執行以下指令。",
    sample:
      "我們決定先向 10% 的使用者開放新功能。小林週四提交測試結果，上線日期待定。",
    tutorial: "查看完整教學",
    weather: {
      clear: "晴",
      partlyCloudy: "局部多雲",
      cloudy: "多雲",
      overcast: "陰",
      fog: "霧",
      haze: "霾或煙霧",
      dust: "沙塵",
      rain: "雨",
      snow: "雪",
      ice: "凍雨或冰粒等降水",
      thunder: "雷雨",
    },
  },
  ja: {
    question: "何とお呼びすればいいですか？ ニックネームでも構いません。",
    greeting: "こんにちは、{name}さん！",
    source:
      "場所は実行端末のネットワーク接続から推定しています。気象情報は wttr.in 提供です。",
    timeZone: "システムのタイムゾーン",
    madeCard:
      "この Loom は、あなたのお名前と近くの天気を使って挨拶カードを作りました。",
    offlineCard:
      "この Loom はお名前を使って挨拶カードを作りました。近くの天気は取得できませんでした。",
    how: "IntLoom はインストールした Loom を実行し、入力が必要なときは返答を待ってから再開します。結果は後から開けるように保存されます。",
    next: "別の Loom も試してみませんか？",
    tryMeeting:
      "meeting-notes を使うと、短い会議メモから共有用の議事録を作れます。",
    install: "インストール",
    run: "初回はチュートリアルに従って構造化出力に対応したモデルを設定し、次の例を実行してください。",
    sample:
      "新機能をまず利用者の10%に公開することに決めた。林さんが木曜日にテスト結果を共有する。公開日は未定。",
    tutorial: "詳しいチュートリアルを見る",
    weather: {
      clear: "晴れ",
      partlyCloudy: "晴れ時々曇り",
      cloudy: "曇り",
      overcast: "厚い雲",
      fog: "霧",
      haze: "もや・煙霧",
      dust: "砂じん",
      rain: "雨",
      snow: "雪",
      ice: "みぞれ・着氷性の降水",
      thunder: "雷",
    },
  },
  ko: {
    question: "어떻게 불러 드릴까요? 별명도 좋아요.",
    greeting: "안녕하세요, {name}님!",
    source:
      "위치는 실행 기기의 네트워크 연결을 기준으로 추정하며, 날씨는 wttr.in에서 제공합니다.",
    timeZone: "시스템 시간대",
    madeCard: "이 Loom은 입력한 이름과 주변 날씨로 인사 카드를 만들었어요.",
    offlineCard:
      "이 Loom은 입력한 이름으로 인사 카드를 만들었어요. 주변 날씨는 가져오지 못했어요.",
    how: "IntLoom은 설치한 Loom을 실행하다가 입력이 필요하면 답을 기다리고, 이어서 작업한 결과를 다시 열 수 있도록 저장해요.",
    next: "다른 Loom도 사용해 볼까요?",
    tryMeeting:
      "meeting-notes로 간단한 회의 메모를 공유할 수 있는 회의록으로 정리해 보세요.",
    install: "설치",
    run: "처음 실행하기 전에 안내에 따라 구조화된 출력을 지원하는 모델을 설정한 뒤 다음 예시를 실행하세요.",
    sample:
      "신기능을 사용자 10%에게 먼저 공개하기로 했다. 민수가 목요일에 테스트 결과를 공유한다. 출시일은 미정이다.",
    tutorial: "자세한 사용법 보기",
    weather: {
      clear: "맑음",
      partlyCloudy: "구름 조금",
      cloudy: "구름 많음",
      overcast: "흐림",
      fog: "안개",
      haze: "연무 또는 연기",
      dust: "모래먼지",
      rain: "비",
      snow: "눈",
      ice: "진눈깨비 등 결빙성 강수",
      thunder: "천둥",
    },
  },
  es: {
    question: "¿Cómo te llamas? Puedes usar un apodo.",
    greeting: "¡Hola, {name}!",
    source:
      "Ubicación estimada a partir de la conexión de red del equipo. Datos meteorológicos de wttr.in.",
    timeZone: "Zona horaria del sistema",
    madeCard:
      "Este Loom ha creado una tarjeta de saludo con tu nombre y el tiempo de tu zona.",
    offlineCard:
      "Este Loom ha creado una tarjeta con tu nombre. No se ha podido consultar el tiempo de tu zona.",
    how: "IntLoom ejecuta los Looms que instalas, espera tu respuesta cuando necesita más información y guarda el resultado para que puedas volver a abrirlo.",
    next: "¿Quieres probar otro Loom?",
    tryMeeting:
      "Con meeting-notes puedes convertir unas notas de reunión en un acta lista para compartir.",
    install: "Instalar",
    run: "Antes de la primera ejecución, sigue el tutorial para configurar un modelo con salida estructurada. Después prueba este ejemplo.",
    sample:
      "Acordamos lanzar la función para el 10% de los usuarios. Ana compartirá los resultados de las pruebas el jueves. La fecha de lanzamiento sigue abierta.",
    tutorial: "Ver el tutorial completo",
    weather: {
      clear: "Despejado",
      partlyCloudy: "Parcialmente nublado",
      cloudy: "Nublado",
      overcast: "Cubierto",
      fog: "Niebla o neblina",
      haze: "Calima o humo",
      dust: "Polvo o arena",
      rain: "Lluvia",
      snow: "Nieve",
      ice: "Precipitación helada",
      thunder: "Tormenta",
    },
  },
  fr: {
    question: "Comment puis-je vous appeler ? Un surnom convient aussi.",
    greeting: "Bonjour, {name} !",
    source:
      "Lieu estimé à partir de la connexion réseau de l’appareil. Météo fournie par wttr.in.",
    timeZone: "Fuseau horaire du système",
    madeCard:
      "Ce Loom a créé une carte de bienvenue avec votre nom et la météo près de chez vous.",
    offlineCard:
      "Ce Loom a créé une carte de bienvenue avec votre nom. La météo locale est indisponible.",
    how: "IntLoom exécute les Looms installés, attend votre réponse si nécessaire, puis enregistre le résultat pour que vous puissiez le retrouver.",
    next: "Envie d’essayer un autre Loom ?",
    tryMeeting:
      "Avec meeting-notes, transformez quelques notes de réunion en un compte rendu à partager.",
    install: "Installation",
    run: "Avant la première exécution, suivez le tutoriel pour configurer un modèle prenant en charge les sorties structurées. Essayez ensuite cet exemple.",
    sample:
      "Nous avons décidé de déployer la fonctionnalité auprès de 10 % des utilisateurs. Léa transmettra les résultats des tests jeudi. La date de lancement reste à fixer.",
    tutorial: "Consulter le tutoriel complet",
    weather: {
      clear: "Ciel dégagé",
      partlyCloudy: "Partiellement nuageux",
      cloudy: "Nuageux",
      overcast: "Couvert",
      fog: "Brume ou brouillard",
      haze: "Brume sèche ou fumée",
      dust: "Poussière ou sable",
      rain: "Pluie",
      snow: "Neige",
      ice: "Précipitations verglaçantes ou glacées",
      thunder: "Orage",
    },
  },
  de: {
    question: "Wie darf ich dich nennen? Ein Spitzname ist auch gut.",
    greeting: "Hallo, {name}!",
    source:
      "Der Ort wird anhand der Netzwerkverbindung des Geräts geschätzt. Wetterdaten von wttr.in.",
    timeZone: "Systemzeitzone",
    madeCard:
      "Dieses Loom hat aus deinem Namen und dem Wetter in deiner Nähe eine Grußkarte erstellt.",
    offlineCard:
      "Dieses Loom hat eine Grußkarte mit deinem Namen erstellt. Das Wetter in deiner Nähe konnte nicht abgerufen werden.",
    how: "IntLoom führt deine installierten Looms aus, wartet bei Rückfragen auf deine Antwort und speichert das Ergebnis, damit du es später wieder öffnen kannst.",
    next: "Möchtest du ein weiteres Loom ausprobieren?",
    tryMeeting:
      "Mit meeting-notes kannst du aus kurzen Besprechungsnotizen ein Protokoll zum Teilen erstellen.",
    install: "Installieren",
    run: "Richte vor dem ersten Start wie im Tutorial beschrieben ein Modell mit strukturierter Ausgabe ein. Probiere dann dieses Beispiel aus.",
    sample:
      "Wir haben den Start für 10 % der Nutzer beschlossen. Lena teilt am Donnerstag die Testergebnisse. Der Starttermin ist noch offen.",
    tutorial: "Zum ausführlichen Tutorial",
    weather: {
      clear: "Klar",
      partlyCloudy: "Leicht bewölkt",
      cloudy: "Bewölkt",
      overcast: "Bedeckt",
      fog: "Nebel oder Dunst",
      haze: "Trockener Dunst oder Rauch",
      dust: "Staub oder Sand",
      rain: "Regen",
      snow: "Schnee",
      ice: "Gefrierender oder eisförmiger Niederschlag",
      thunder: "Gewitter",
    },
  },
  pt: {
    question: "Como posso chamar você? Pode ser um apelido.",
    greeting: "Olá, {name}!",
    source:
      "Local estimado pela conexão de rede do dispositivo. Dados meteorológicos de wttr.in.",
    timeZone: "Fuso horário do sistema",
    madeCard:
      "Este Loom criou um cartão de boas-vindas com seu nome e o tempo na sua região.",
    offlineCard:
      "Este Loom criou um cartão com seu nome. Não foi possível consultar o tempo na sua região.",
    how: "O IntLoom executa os Looms instalados, aguarda sua resposta quando precisa de informações e salva o resultado para você abrir depois.",
    next: "Quer experimentar outro Loom?",
    tryMeeting:
      "Use o meeting-notes para transformar anotações de uma reunião em uma ata que você pode compartilhar.",
    install: "Instalar",
    run: "Antes da primeira execução, siga o tutorial para configurar um modelo com suporte a saídas estruturadas. Depois teste este exemplo.",
    sample:
      "Decidimos liberar o recurso para 10% dos usuários. Ana vai compartilhar os resultados dos testes na quinta-feira. A data de lançamento continua em aberto.",
    tutorial: "Ver o tutorial completo",
    weather: {
      clear: "Céu limpo",
      partlyCloudy: "Parcialmente nublado",
      cloudy: "Nublado",
      overcast: "Encoberto",
      fog: "Névoa ou nevoeiro",
      haze: "Névoa seca ou fumaça",
      dust: "Poeira ou areia",
      rain: "Chuva",
      snow: "Neve",
      ice: "Precipitação congelante",
      thunder: "Trovoada",
    },
  },
  ar: {
    question: "بأي اسم تحب أن أناديك؟ يمكنك اختيار اسم مستعار.",
    greeting: "مرحبًا يا {name}!",
    source:
      "الموقع تقريبي ويعتمد على اتصال الجهاز بالشبكة. بيانات الطقس من wttr.in.",
    timeZone: "المنطقة الزمنية للنظام",
    madeCard:
      "أنشأ هذا الـ Loom بطاقة ترحيب باسمك وأضاف إليها حالة الطقس بالقرب منك.",
    offlineCard:
      "أنشأ هذا الـ Loom بطاقة ترحيب باسمك. تعذّر الحصول على حالة الطقس بالقرب منك.",
    how: "يشغّل IntLoom حزم Loom المثبّتة، وينتظر إجابتك عندما يحتاج إلى معلومات، ثم يتابع العمل ويحفظ النتيجة لتتمكن من فتحها لاحقًا.",
    next: "هل تود تجربة Loom آخر؟",
    tryMeeting:
      "استخدم meeting-notes لتحويل ملاحظات اجتماع قصيرة إلى محضر يمكنك مشاركته.",
    install: "التثبيت",
    run: "قبل التشغيل الأول، اتبع الدليل لإعداد نموذج يدعم المخرجات المنظّمة. ثم جرّب المثال التالي.",
    sample:
      "قررنا إتاحة الميزة أولًا لعشرة بالمئة من المستخدمين. سترسل ليلى نتائج الاختبارات يوم الخميس. لم يتحدد موعد الإطلاق بعد.",
    tutorial: "عرض الدليل المفصّل",
    weather: {
      clear: "صافٍ",
      partlyCloudy: "غائم جزئيًا",
      cloudy: "غائم",
      overcast: "ملبّد بالغيوم",
      fog: "ضباب",
      haze: "غشاوة أو دخان",
      dust: "غبار أو رمال",
      rain: "مطر",
      snow: "ثلج",
      ice: "هطول جليدي",
      thunder: "رعد",
    },
  },
} satisfies Record<Language, Messages>;

interface Messages {
  question: string;
  greeting: string;
  source: string;
  timeZone: string;
  madeCard: string;
  offlineCard: string;
  how: string;
  next: string;
  tryMeeting: string;
  install: string;
  run: string;
  sample: string;
  tutorial: string;
  weather: Record<Condition, string>;
}
