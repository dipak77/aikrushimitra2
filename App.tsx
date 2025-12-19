
import React, { useState, useEffect, useRef } from 'react';
import { ViewState, Language, UserProfile, ChatMessage, BlogPost, BlogSection, FAQ } from './types';
import { TRANSLATIONS } from './constants';
import { 
  Sprout, CloudSun, ScanLine, Mic, Droplets, ArrowLeft, User, Home, Store, 
  Wind, Camera, X, Send, Wheat, Sun, MapPin, Calendar, ArrowUpRight, 
  Landmark, CalendarClock, Newspaper, Radio, BookOpen, Info, Bookmark, 
  Share2, MessageSquare, TrendingUp, AlertTriangle, ChevronRight, 
  CheckCircle2, Activity, Zap, Leaf, Loader2, Gauge, Thermometer, Droplet,
  Volume2, VolumeX, UserCircle, Clock, Facebook, Twitter, MessageCircle,
  Search, Menu, MoreVertical, AudioLines, MicOff, Waves, Download, Play, Pause, Save, History, RefreshCw,
  Settings, HelpCircle, Info as InfoIcon, Timer, Sparkles, Mic2, Bell, ShieldCheck
} from 'lucide-react';
import { Button } from './components/Button';
import { getAIFarmingAdvice, analyzeCropDisease } from './services/geminiService';
// Fix: Renamed Gemini Blob to GenAIBlob to avoid shadowing global browser Blob
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAIBlob } from '@google/genai';

// --- AUDIO HELPERS ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Fix: Updated return type to GenAIBlob to match the aliased import
function createPCMChunk(data: Float32Array): GenAIBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const getLangCode = (lang: Language) => {
  switch (lang) {
    case 'mr': return 'mr-IN';
    case 'hi': return 'hi-IN';
    case 'en': return 'en-US';
    default: return 'en-US';
  }
};

const speak = (text: string, lang: Language, onEnd?: () => void) => {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = getLangCode(lang);
  utterance.rate = 0.85;
  utterance.pitch = 1.0; 
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
};

// --- MOCK CONTENT ---
const MOCK_BLOGS: BlogPost[] = [
  {
    id: 'smart-farming-2025',
    title: 'Smart Farming Tools 2025: शेतकऱ्यांसाठी नव्या तंत्रज्ञानाचा क्रांतिकारी सुरवात',
    category: 'आधुनिक शेती तंत्रज्ञान',
    date: 'April 27, 2025',
    author: 'AI Krushi Mitra',
    image: 'https://images.unsplash.com/photo-1594398901394-4e34939a4fd0?q=80&w=1200',
    intro: 'प्रस्तावना: Smart Farming Tools 2025: भारतीय शेतीला सुधारण्याच्या आणि शेतकऱ्यांच्या जीवनात बदल घडवण्याच्या दिशेने विविध तंत्रज्ञानांचा वापर होऊ लागला आहे...',
    sections: [
      {
        heading: '1. ड्रोन तंत्रज्ञान: शेतकऱ्यांसाठी फायदेशिर उपाय',
        content: 'ड्रोन तंत्रज्ञानाचा वापर शेतीत वेगाने वाढत आहे. यामुळे फवारणी, पिकांचे निरीक्षण आणि जमिनीची पाहणी करणे सोपे झाले आहे.',
        image: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?q=80&w=1200'
      }
    ],
    conclusion: 'Smart Farming Tools शेतकऱ्यांसाठी 2025 मध्ये एक गेम चेंजर ठरणार आहेत.'
  }
];

const MOCK_MARKET_DATA = [
  { name: 'Soyabean', price: 4850, trend: '+120', arrival: '1200 Qt', color: 'text-green-500' },
  { name: 'Cotton (Kapas)', price: 7200, trend: '-50', arrival: '850 Qt', color: 'text-red-500' },
  { name: 'Tur (Pigeon Pea)', price: 10400, trend: '+300', arrival: '400 Qt', color: 'text-green-500' },
  { name: 'Wheat', price: 2450, trend: '+10', arrival: '2200 Qt', color: 'text-green-500' },
  { name: 'Onion', price: 1800, trend: '-200', arrival: '5000 Qt', color: 'text-red-500' }
];

const MOCK_SCHEMES = [
  { id: 1, title: 'PM-Kisan Samman Nidhi', benefit: '₹6,000 yearly', deadline: 'Open', image: 'https://images.unsplash.com/photo-1590682680393-024294026367?q=80&w=600' },
  { id: 2, title: 'Pradhan Mantri Fasal Bima', benefit: 'Crop Insurance', deadline: '31 Aug 2025', image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=600' },
  { id: 3, title: 'Drip Irrigation Subsidy', benefit: '80% Subsidy', deadline: 'Ongoing', image: 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?q=80&w=600' }
];

// --- SUB-VIEWS ---

const MarketView = ({ lang, onBack }: any) => {
  const t = TRANSLATIONS[lang];
  return (
    <div className="h-full bg-stone-50 overflow-y-auto pb-32">
       <header className="bg-white border-b border-gray-100 px-6 py-6 flex items-center justify-between sticky top-0 z-50">
          <button onClick={onBack} className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></button>
          <span className="text-2xl font-black italic"><span className="text-[#3a7c3e]">AI Krushi</span><span className="text-[#8b4513]"> Mitra</span></span>
          <div className="w-10"></div>
       </header>
       <div className="p-6 max-w-4xl mx-auto space-y-6">
          <div className="bg-green-600 text-white p-8 rounded-[2.5rem] shadow-xl">
             <h2 className="text-3xl font-black mb-2">{t.market_rate}</h2>
             <p className="opacity-80 font-bold">{t.today}: 27 April, 2025</p>
          </div>
          <div className="grid gap-4">
             {MOCK_MARKET_DATA.map((item, idx) => (
               <div key={idx} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between group hover:border-green-500 transition-all">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-600"><Wheat size={24}/></div>
                     <div>
                        <h4 className="text-xl font-bold text-gray-900">{item.name}</h4>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{t.arrival}: {item.arrival}</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <div className="text-2xl font-black text-gray-900">₹{item.price}</div>
                     <div className={`text-sm font-bold flex items-center justify-end gap-1 ${item.color}`}>
                        {item.trend.startsWith('+') ? <ArrowUpRight size={14}/> : <TrendingUp size={14} className="rotate-180"/>}
                        {item.trend}
                     </div>
                  </div>
               </div>
             ))}
          </div>
       </div>
    </div>
  );
};

const WeatherView = ({ lang, onBack }: any) => {
  const t = TRANSLATIONS[lang];
  return (
    <div className="h-full bg-sky-50 overflow-y-auto pb-32">
       <header className="bg-white border-b border-gray-100 px-6 py-6 flex items-center justify-between sticky top-0 z-50">
          <button onClick={onBack} className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></button>
          <span className="text-2xl font-black italic"><span className="text-[#3a7c3e]">AI Krushi</span><span className="text-[#8b4513]"> Mitra</span></span>
          <div className="w-10"></div>
       </header>
       <div className="p-6 max-w-4xl mx-auto space-y-8">
          <div className="bg-gradient-to-br from-sky-400 to-blue-600 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
             <Sun className="absolute -top-10 -right-10 w-64 h-64 opacity-20 animate-spin-slow" />
             <div className="relative z-10 flex justify-between items-end">
                <div>
                   <p className="text-lg font-bold opacity-80 uppercase tracking-widest">{t.today}</p>
                   <h2 className="text-8xl font-black tracking-tighter">28°C</h2>
                   <p className="text-2xl font-bold mt-2">Sunny / निरभ्र आकाश</p>
                </div>
                <div className="text-right">
                   <div className="flex items-center justify-end gap-2 text-xl font-bold"><Droplet/> 45% {t.humidity}</div>
                   <div className="flex items-center justify-end gap-2 text-xl font-bold"><Wind/> 12 km/h {t.wind}</div>
                </div>
             </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-l-[12px] border-emerald-500 space-y-4">
             <div className="flex items-center gap-3 text-emerald-600 font-black text-2xl">
                <ShieldCheck size={32}/> {t.spray_advice}
             </div>
             <p className="text-xl text-gray-700 font-medium">
                {lang === 'mr' ? 'आरं पाटील, आज फवारणीसाठी लय भारी हवा आहे. वारा कमी आहे आणि पाऊस पण नाहीये.' : t.safe_to_spray}
             </p>
          </div>

          <div className="grid grid-cols-4 gap-4">
             {['Mon', 'Tue', 'Wed', 'Thu'].map((day, i) => (
               <div key={i} className="bg-white/60 p-6 rounded-3xl text-center backdrop-blur-md border border-white/20">
                  <p className="text-stone-400 font-bold uppercase text-xs mb-2">{day}</p>
                  <Sun className="mx-auto text-amber-500 mb-2" size={32}/>
                  <p className="text-xl font-black text-stone-800">29°</p>
               </div>
             ))}
          </div>
       </div>
    </div>
  );
};

const SchemesView = ({ lang, onBack }: any) => {
  const t = TRANSLATIONS[lang];
  return (
    <div className="h-full bg-stone-50 overflow-y-auto pb-32">
       <header className="bg-white border-b border-gray-100 px-6 py-6 flex items-center justify-between sticky top-0 z-50">
          <button onClick={onBack} className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></button>
          <span className="text-2xl font-black italic"><span className="text-[#3a7c3e]">AI Krushi</span><span className="text-[#8b4513]"> Mitra</span></span>
          <div className="w-10"></div>
       </header>
       <div className="p-6 max-w-5xl mx-auto space-y-8">
          <h2 className="text-4xl font-black text-stone-900 tracking-tight">{t.schemes}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {MOCK_SCHEMES.map((s) => (
               <div key={s.id} className="bg-white rounded-[2.5rem] overflow-hidden shadow-xl border border-stone-200 group hover:border-emerald-500 transition-all">
                  <div className="h-56 relative overflow-hidden">
                     <img src={s.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={s.title} />
                     <div className="absolute top-4 right-4 px-4 py-2 bg-emerald-500 text-white rounded-full text-xs font-black uppercase tracking-widest">{s.deadline}</div>
                  </div>
                  <div className="p-8">
                     <h3 className="text-2xl font-black mb-2">{s.title}</h3>
                     <p className="text-emerald-600 font-bold text-lg mb-6">{s.benefit}</p>
                     <button className="w-full py-5 bg-stone-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-600 transition-colors">
                        {t.apply} <ChevronRight size={18}/>
                     </button>
                  </div>
               </div>
             ))}
          </div>
       </div>
    </div>
  );
};

// --- AGRI BLOG COMPONENT ---
const AgriBlog = ({ lang, onBack }: { lang: Language, onBack: () => void }) => {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  return (
    <div className="h-full bg-slate-50 overflow-y-auto pb-32">
       <header className="bg-white border-b border-gray-100 px-6 py-6 flex items-center justify-between sticky top-0 z-50">
          <button onClick={selectedPost ? () => setSelectedPost(null) : onBack} className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></button>
          <span className="text-2xl font-black italic"><span className="text-[#3a7c3e]">AI Krushi</span><span className="text-[#8b4513]"> Mitra</span></span>
          <div className="w-10"></div>
       </header>
       {!selectedPost ? (
         <div className="p-8 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {MOCK_BLOGS.map(post => (
             <div key={post.id} onClick={() => setSelectedPost(post)} className="bg-white rounded-[2.5rem] overflow-hidden shadow-xl border border-gray-100 cursor-pointer group hover:-translate-y-2 transition-all duration-300">
                <div className="h-64 overflow-hidden relative"><img src={post.image} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500" alt={post.title} /></div>
                <div className="p-8 space-y-4">
                   <h3 className="text-2xl font-black text-slate-900">{post.title}</h3>
                   <p className="text-gray-500 line-clamp-2">{post.intro}</p>
                </div>
             </div>
           ))}
         </div>
       ) : (
         <div className="max-w-4xl mx-auto bg-white min-h-screen p-12 space-y-8 animate-in fade-in duration-500">
            <h1 className="text-4xl font-black leading-tight text-gray-900">{selectedPost.title}</h1>
            <div className="flex items-center gap-4 text-stone-400 font-bold uppercase tracking-widest text-xs">
               <span className="bg-emerald-500 text-white px-3 py-1 rounded-full">{selectedPost.category}</span>
               <span>{selectedPost.date}</span>
            </div>
            <img src={selectedPost.image} className="w-full rounded-[2.5rem] shadow-2xl" alt="Post" />
            <p className="text-xl leading-relaxed text-gray-700 whitespace-pre-wrap">{selectedPost.intro}</p>
            {selectedPost.sections.map((s, i) => (
              <div key={i} className="space-y-6">
                 <h2 className="text-3xl font-black text-gray-900">{s.heading}</h2>
                 <p className="text-xl leading-relaxed text-gray-700">{s.content}</p>
                 {s.image && <img src={s.image} className="w-full rounded-[2.5rem] shadow-xl" alt="Section" />}
              </div>
            ))}
            <div className="bg-stone-50 p-10 rounded-[2.5rem] border-l-[12px] border-emerald-500">
               <h3 className="text-2xl font-black mb-4">निष्कर्ष:</h3>
               <p className="text-lg font-medium text-gray-600 italic">{selectedPost.conclusion}</p>
            </div>
         </div>
       )}
    </div>
  );
};

// --- PRO VOICE ASSISTANT ---
const VoiceAssistant = ({ lang, user, onBack }: { lang: Language, user: UserProfile, onBack: () => void }) => {
  const t = TRANSLATIONS[lang];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userTranscription, setUserTranscription] = useState('');
  const [aiTranscription, setAiTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<any>(null);
  const shouldBeActiveRef = useRef<boolean>(false);
  const timerRef = useRef<any>(null);
  
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // Fix: This correctly refers to the global browser Blob now that the GenAI import is aliased
  const recordingChunksRef = useRef<Blob[]>([]);
  const mixedStreamDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, userTranscription, aiTranscription]);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => setTimer(prev => prev + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setTimer(0);
    }
    return () => clearInterval(timerRef.current);
  }, [isActive]);

  const cleanupSessionResources = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (audioContextInRef.current) {
        audioContextInRef.current.close();
        audioContextInRef.current = null;
    }
    if (audioContextOutRef.current) {
        audioContextOutRef.current.close();
        audioContextOutRef.current = null;
    }
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    setIsActive(false);
    setIsSpeaking(false);
  };

  const stopSession = () => {
    shouldBeActiveRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanupSessionResources();
  };

  const startSession = async (isRetry = false) => {
    if (!isRetry) {
        shouldBeActiveRef.current = true;
        setRecordingUrl(null);
        recordingChunksRef.current = [];
    }
    if (!shouldBeActiveRef.current) return;
    try {
      setError(null);
      setIsConnecting(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      mixedStreamDestinationRef.current = audioContextOutRef.current.createMediaStreamDestination();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const sourceMic = audioContextInRef.current.createMediaStreamSource(stream);
      const micForRecording = audioContextOutRef.current.createMediaStreamSource(stream);
      micForRecording.connect(mixedStreamDestinationRef.current);
      const scriptProcessor = audioContextInRef.current.createScriptProcessor(4096, 1, 1);

      const systemInstruction = lang === 'mr' 
        ? `तू 'AI कृषी मित्र' आहेस. अस्सल ग्रामीण मराठमोळी भाषा (गावठी बाणा) वापर. 
           शेतकऱ्यांशी त्यांच्या बांधावर बसून गप्पा मारतोयस असा फिल दे. 
           'राम राम पाटील!', 'काय म्हणतंय पीक?', 'आरं काळजी नको', 'लय भारी' असे अस्सल गावरान शब्द वापर. 
           शेतकरी ${user.crop} बद्दल विचारू शकतो. 
           उत्तरं खूप मोठी नसावीत, जशी आपण प्रत्यक्ष बोलतो तशी लहान आणि प्रभावी दे.`
        : `You are 'AI Krushi Mitra'. Speak like a friendly local agri-expert in a native warm tone. Be brief and highly conversational. Farmer is growing ${user.crop}.`;

      if (!isRetry) {
          mediaRecorderRef.current = new MediaRecorder(mixedStreamDestinationRef.current.stream);
          mediaRecorderRef.current.ondataavailable = (e) => {
            if (e.data.size > 0) recordingChunksRef.current.push(e.data);
          };
          mediaRecorderRef.current.onstop = () => {
            const blob = new window.Blob(recordingChunksRef.current, { type: 'audio/webm' });
            setRecordingUrl(URL.createObjectURL(blob));
          };
          mediaRecorderRef.current.start();
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
          systemInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setIsConnecting(false);
            sourceMic.connect(scriptProcessor);
            scriptProcessor.connect(audioContextInRef.current!.destination);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPCMChunk(inputData);
              sessionPromise.then(session => { if (session) session.sendRealtimeInput({ media: pcmBlob }); });
            };
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.outputTranscription) setAiTranscription(prev => prev + msg.serverContent!.outputTranscription!.text);
            if (msg.serverContent?.inputTranscription) setUserTranscription(prev => prev + msg.serverContent!.inputTranscription!.text);
            if (msg.serverContent?.turnComplete) {
              setMessages(prev => [
                ...prev,
                { id: `u-${Date.now()}`, role: 'user', text: userTranscription, timestamp: new Date() },
                { id: `a-${Date.now()}`, role: 'model', text: aiTranscription, timestamp: new Date() }
              ]);
              setUserTranscription('');
              setAiTranscription('');
            }
            const audioBase64 = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioBase64 && audioContextOutRef.current) {
              setIsSpeaking(true);
              const ctx = audioContextOutRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(audioBase64), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              if (mixedStreamDestinationRef.current) source.connect(mixedStreamDestinationRef.current);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onerror: (e) => {
            if (shouldBeActiveRef.current) { cleanupSessionResources(); setTimeout(() => startSession(true), 1500); }
          },
          onclose: () => { if (shouldBeActiveRef.current) { cleanupSessionResources(); setTimeout(() => startSession(true), 800); } }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      setError("Microphone access required.");
      setIsConnecting(false);
    }
  };

  const downloadRecording = () => {
    if (recordingUrl) {
      const link = document.createElement('a');
      link.href = recordingUrl;
      link.download = `aikrushi-discussion-${Date.now()}.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full bg-[#030a03] flex flex-col relative overflow-hidden font-sans">
       <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[120px] transition-all duration-1000 ${isActive ? 'scale-125 opacity-40' : 'scale-75 opacity-0'}`}></div>
       </div>

       <div className="relative z-10 p-6 flex justify-between items-center bg-black/40 backdrop-blur-2xl border-b border-white/5">
          <div className="flex items-center gap-4">
             <button onClick={onBack} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors"><ArrowLeft size={24} className="text-white"/></button>
             <div>
                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">Krushi AI Voice <Sparkles size={16} className="text-emerald-400"/></h2>
                <div className="flex items-center gap-2 mt-0.5">
                   <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`}></div>
                   <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{isActive ? 'Session Active' : 'Ready'}</span>
                </div>
             </div>
          </div>
          {isActive && (
            <div className="px-4 py-2 bg-white/5 rounded-2xl flex items-center gap-3 border border-white/10">
               <Timer size={16} className="text-emerald-400" />
               <span className="text-white font-mono font-bold">{formatTime(timer)}</span>
            </div>
          )}
       </div>

       <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
          {messages.length === 0 && !userTranscription && !aiTranscription && !recordingUrl && (
            <div className="max-w-xl mx-auto text-center space-y-6 pt-20 animate-in fade-in zoom-in duration-1000">
               <div className="w-24 h-24 bg-emerald-500/20 rounded-full mx-auto flex items-center justify-center border border-emerald-500/30">
                  <Mic2 size={40} className="text-emerald-400" />
               </div>
               <h3 className="text-3xl font-black text-white tracking-tight">{lang === 'mr' ? 'राम राम पाटील, बोला की!' : 'Hello, please speak!'}</h3>
               <p className="text-white/40 font-medium">पिकाबद्दल काहीही विचारा, आपला कृषी मित्र हजर आहे.</p>
            </div>
          )}

          {messages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4`}>
               <div className={`max-w-[85%] p-6 rounded-[2rem] shadow-2xl ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-[#1a1a1a] text-white rounded-tl-none border border-white/10'}`}>
                  <p className="text-lg font-bold leading-relaxed">{m.text}</p>
               </div>
            </div>
          ))}

          {(userTranscription || aiTranscription) && (
            <div className="space-y-4">
              {userTranscription && (
                <div className="flex justify-end animate-in fade-in slide-in-from-right-4">
                   <div className="max-w-[80%] p-6 rounded-[2rem] bg-emerald-900/40 text-emerald-100 italic rounded-tr-none border-r-4 border-emerald-400">
                      {userTranscription}...
                   </div>
                </div>
              )}
              {aiTranscription && (
                <div className="flex justify-start animate-in fade-in slide-in-from-left-4">
                   <div className="max-w-[80%] p-6 rounded-[2rem] bg-white/5 text-white/60 italic rounded-tl-none border-l-4 border-emerald-500 flex items-center gap-4">
                      <Loader2 size={18} className="animate-spin text-emerald-500" />
                      {aiTranscription}...
                   </div>
                </div>
              )}
            </div>
          )}

          {!isActive && !isConnecting && recordingUrl && (
            <div className="animate-in slide-in-from-top-10 duration-700 bg-emerald-500/5 border border-emerald-500/10 p-10 rounded-[3.5rem] text-center space-y-8">
               <div className="space-y-2">
                  <h3 className="text-3xl font-black text-white tracking-tighter">चर्चा रेकॉर्ड झाली आहे!</h3>
                  <p className="text-white/40 font-bold uppercase tracking-widest text-[10px]">Session Recording Ready</p>
               </div>
               <audio controls src={recordingUrl} className="w-full filter invert grayscale opacity-80" />
               <div className="flex gap-4">
                  <button onClick={downloadRecording} className="flex-1 bg-emerald-500 text-black px-8 py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-all">
                     Download Discussion
                  </button>
                  <button onClick={() => setRecordingUrl(null)} className="bg-white/5 text-white/40 px-8 py-5 rounded-2xl font-black uppercase text-xs">
                     Dismiss
                  </button>
               </div>
            </div>
          )}
          <div ref={scrollRef} />
       </div>

       <div className="relative z-10 p-10 bg-gradient-to-t from-black via-black/90 to-transparent">
          <div className="max-w-2xl mx-auto flex flex-col items-center gap-8">
             {isActive && (
               <div className="flex items-center gap-1.5 h-16 w-full justify-center">
                  {[...Array(20)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-1 rounded-full bg-emerald-500/40 transition-all duration-300 ${isSpeaking ? 'animate-pulse h-full' : 'animate-bounce h-1/4'}`} 
                      style={{ animationDelay: `${i * 0.05}s` }}
                    ></div>
                  ))}
               </div>
             )}
             <button 
               disabled={isConnecting}
               onClick={isActive ? stopSession : () => startSession()}
               className={`relative w-28 h-28 rounded-full shadow-2xl flex items-center justify-center transition-all ${isActive ? 'bg-red-500' : isConnecting ? 'bg-amber-500/20' : 'bg-emerald-500 hover:scale-110 active:scale-95'}`}
             >
                {isActive ? <MicOff size={40} className="text-white"/> : isConnecting ? <RefreshCw size={40} className="text-amber-500 animate-spin"/> : <Mic size={40} className="text-black"/>}
             </button>
          </div>
       </div>
    </div>
  );
};

// --- DISEASE DETECTOR ---
const DiseaseDetector = ({ lang, onBack }: { lang: Language, onBack: () => void }) => {
  const t = TRANSLATIONS[lang];
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setImage(base64);
      setLoading(true);
      const analysis = await analyzeCropDisease(base64, lang);
      setResult(analysis);
      setLoading(false);
      speak(analysis, lang);
    };
    reader.readAsDataURL(file);
  };
  return (
    <div className="h-full bg-stone-50 overflow-y-auto pb-32">
       <header className="bg-white border-b border-gray-100 px-6 py-6 flex items-center justify-between sticky top-0 z-50">
          <button onClick={onBack} className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft/></button>
          <span className="text-2xl font-black italic"><span className="text-[#3a7c3e]">AI Krushi</span><span className="text-[#8b4513]"> Mitra</span></span>
          <div className="w-10"></div>
       </header>
       <div className="p-8 max-w-4xl mx-auto space-y-8">
          {!image ? (
            <div onClick={() => fileInputRef.current?.click()} className="aspect-video bg-white border-4 border-dashed border-emerald-200 rounded-[3rem] flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-50 group transition-all">
               <Camera size={48} className="text-emerald-600 group-hover:scale-110 transition-transform"/>
               <p className="mt-6 text-xl font-bold text-emerald-800">{t.upload_photo}</p>
               <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handleCapture} />
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in zoom-in duration-500">
               <div className="relative rounded-[3rem] overflow-hidden shadow-2xl border-8 border-white">
                  <img src={image} className="w-full h-auto" alt="Crop" />
                  <button onClick={() => { setImage(null); setResult(null); window.speechSynthesis.cancel(); }} className="absolute top-6 right-6 p-4 bg-black/50 text-white rounded-full backdrop-blur-md"><X/></button>
               </div>
               {loading ? (
                 <div className="bg-white p-12 rounded-[3rem] shadow-xl flex flex-col items-center gap-6">
                    <Loader2 className="animate-spin text-emerald-600" size={64}/>
                    <p className="text-2xl font-black text-emerald-800 tracking-tighter uppercase">{t.analyzing}</p>
                 </div>
               ) : result && (
                 <div className="bg-white p-10 rounded-[3rem] shadow-xl border-l-[12px] border-emerald-500 space-y-6">
                    <h3 className="text-3xl font-black text-emerald-600 flex items-center gap-3"><CheckCircle2 size={32}/> {t.result}</h3>
                    <div className="text-gray-700 text-xl font-medium leading-relaxed whitespace-pre-wrap">{result}</div>
                 </div>
               )}
            </div>
          )}
       </div>
    </div>
  );
};

// --- HUB ---
const Hub = ({ lang, user, onNavigate }: any) => {
  const t = TRANSLATIONS[lang];
  return (
    <div className="h-full relative bg-stone-50 text-stone-900 overflow-y-auto pb-32 scrollbar-hide">
       {/* Alert Bar */}
       <div className="bg-amber-100 p-4 border-b border-amber-200 flex items-center justify-center gap-4 animate-in slide-in-from-top duration-700">
          <Bell className="text-amber-600 animate-swing" size={20}/>
          <p className="text-sm font-bold text-amber-900">
             {lang === 'mr' ? 'पाऊस येण्याची शक्यता: पुढच्या २ तासात शेतात पाणी साचू शकते!' : 'Rain Alert: Heavy rain expected in 2 hours!'}
          </p>
       </div>

       <div className="px-6 py-10 max-w-7xl mx-auto space-y-12">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
             <div className="flex-1">
                <div className="px-4 py-1 bg-emerald-600 text-white rounded-full text-[10px] font-black tracking-widest uppercase w-fit mb-4">Krushi Mitra Network</div>
                <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none animate-in slide-in-from-left-10 duration-1000">नमस्कार, <br/><span className="text-emerald-600">{user.name.split(' ')[0]}!</span></h1>
             </div>
             <div onClick={() => onNavigate('WEATHER')} className="cursor-pointer bg-white p-6 rounded-[2.5rem] border border-stone-200 flex items-center gap-6 shadow-xl hover:scale-105 transition-transform group">
                <div className="text-right"><div className="text-5xl font-black">28°C</div><div className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Sunny</div></div>
                <div className="p-4 bg-sky-100 rounded-[1.5rem] group-hover:bg-sky-200 transition-colors"><CloudSun size={40} className="text-sky-500" /></div>
             </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
             <div onClick={() => onNavigate('BLOG')} className="md:col-span-8 relative h-[400px] rounded-[3.5rem] overflow-hidden group cursor-pointer border border-stone-200 shadow-xl">
                <img src={MOCK_BLOGS[0].image} className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt="Blog" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-10 w-full md:w-3/4">
                   <h2 className="text-3xl lg:text-4xl font-black text-white mb-6 tracking-tighter leading-tight">{MOCK_BLOGS[0].title}</h2>
                   <button className="bg-white text-black px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-3 active:scale-95 transition-all">लेख वाचा <ArrowUpRight size={20}/></button>
                </div>
             </div>
             <div onClick={() => onNavigate('DISEASE_DETECTOR')} className="md:col-span-4 relative h-[400px] rounded-[3.5rem] overflow-hidden group cursor-pointer border border-stone-200 bg-white hover:bg-emerald-50 transition-all shadow-xl">
                <div className="absolute inset-0 p-10 flex flex-col justify-end">
                   <div className="p-4 bg-emerald-100 rounded-3xl text-emerald-600 w-fit mb-6"><ScanLine size={32} /></div>
                   <h3 className="text-3xl font-black leading-none mb-4 tracking-tighter">{t.disease_check}</h3>
                   <p className="text-stone-500 font-bold mb-6 text-sm">पिकाचा फोटो काढून AI द्वारे रोगाचे निदान करा.</p>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
             <ActionCard title={t.voice_help} icon={Mic} delay="delay-75" color="bg-emerald-600" onClick={() => onNavigate('VOICE_ASSISTANT')} />
             <ActionCard title={t.market} icon={Store} delay="delay-100" color="bg-amber-500" onClick={() => onNavigate('MARKET')} />
             <ActionCard title={t.schemes} icon={Landmark} delay="delay-150" color="bg-stone-900" onClick={() => onNavigate('SCHEMES')} />
             <ActionCard title={t.profit} icon={TrendingUp} delay="delay-200" color="bg-blue-600" onClick={() => onNavigate('YIELD')} />
          </div>
       </div>

       {/* Floating Quick Action */}
       <div className="fixed bottom-10 right-10 z-50">
          <button onClick={() => onNavigate('VOICE_ASSISTANT')} className="p-8 bg-emerald-600 rounded-full shadow-2xl border-4 border-white transition-all active:scale-90 hover:scale-110 group relative">
             <div className="absolute inset-0 bg-emerald-600 rounded-full animate-ping opacity-20"></div>
             <Mic size={36} className="text-white" />
          </button>
       </div>
    </div>
  );
};

const ActionCard = ({ title, icon: Icon, onClick, delay, color }: any) => (
  <div onClick={onClick} className={`bg-white p-8 rounded-[3rem] shadow-xl border border-stone-200 cursor-pointer group hover:-translate-y-2 transition-all animate-in slide-in-from-bottom-5 ${delay}`}>
    <div className={`${color} w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-white group-hover:scale-110 transition-transform shadow-lg shadow-gray-200`}><Icon size={28} /></div>
    <h3 className="text-2xl font-black tracking-tighter leading-tight text-stone-900">{title}</h3>
  </div>
);

const Sidebar = ({ view, setView, lang }: any) => {
  const t = TRANSLATIONS[lang];
  const items = [
    { id: 'DASHBOARD', icon: Home, label: t.dashboard },
    { id: 'BLOG', icon: Newspaper, label: t.blog },
    { id: 'DISEASE_DETECTOR', icon: ScanLine, label: t.disease_check },
    { id: 'MARKET', icon: Store, label: t.market },
    { id: 'VOICE_ASSISTANT', icon: Mic, label: t.voice_help },
    { id: 'WEATHER', icon: CloudSun, label: t.weather },
    { id: 'SCHEMES', icon: Landmark, label: t.schemes },
  ];
  return (
    <div className="w-80 bg-white border-r border-stone-200 flex flex-col h-full hidden lg:flex">
      <div className="p-10 flex items-center gap-4 cursor-pointer" onClick={() => setView('DASHBOARD')}>
         <div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-lg"><Sprout size={28} /></div>
         <h1 className="font-black text-2xl text-stone-900 tracking-tighter">AI Krushi</h1>
      </div>
      <div className="flex-1 p-6 space-y-2 overflow-y-auto scrollbar-hide">
        {items.map((item) => (
          <button key={item.id} onClick={() => setView(item.id)} className={`w-full flex items-center gap-5 p-5 rounded-2xl transition-all duration-300 font-bold ${view === item.id ? 'bg-emerald-600 text-white shadow-xl translate-x-2' : 'text-stone-400 hover:text-stone-900 hover:bg-stone-50'}`}>
            <item.icon size={22} /><span className="text-sm tracking-tight">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="p-10 border-t border-stone-100">
         <div className="flex items-center gap-4 text-stone-400 font-bold text-xs uppercase tracking-widest cursor-pointer hover:text-red-500 transition-colors">
            <Radio size={18}/> {t.logout}
         </div>
      </div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<ViewState>('SPLASH');
  const [lang, setLang] = useState<Language>('mr');
  const [user] = useState<UserProfile>({ name: 'Sanjay Pawar', village: 'Baramati', district: 'Pune', landSize: '5', crop: 'Soyabean' });

  const renderContent = () => {
    switch (view) {
      case 'SPLASH': return <SplashScreen onComplete={() => setView('LANGUAGE')} />;
      case 'LANGUAGE': return <LanguageSelection onSelect={(l) => { setLang(l); setView('DASHBOARD'); }} />;
      case 'DASHBOARD': return <Hub lang={lang} user={user} onNavigate={setView} />;
      case 'BLOG': return <AgriBlog lang={lang} onBack={() => setView('DASHBOARD')} />;
      case 'DISEASE_DETECTOR': return <DiseaseDetector lang={lang} onBack={() => setView('DASHBOARD')} />;
      case 'VOICE_ASSISTANT': return <VoiceAssistant lang={lang} user={user} onBack={() => setView('DASHBOARD')} />;
      case 'MARKET': return <MarketView lang={lang} onBack={() => setView('DASHBOARD')} />;
      case 'WEATHER': return <WeatherView lang={lang} onBack={() => setView('DASHBOARD')} />;
      case 'SCHEMES': return <SchemesView lang={lang} onBack={() => setView('DASHBOARD')} />;
      default: return <Hub lang={lang} user={user} onNavigate={setView} />;
    }
  };

  if (view === 'SPLASH' || view === 'LANGUAGE') return renderContent();

  return (
    <div className="flex h-screen bg-stone-50 font-sans overflow-hidden">
      <Sidebar view={view} setView={setView} lang={lang} />
      <div className="flex-1 relative h-full overflow-hidden">{renderContent()}</div>
    </div>
  );
}

const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  useEffect(() => { const t = setTimeout(onComplete, 2500); return () => clearTimeout(t); }, []);
  return (
    <div className="h-full bg-emerald-600 flex flex-col items-center justify-center text-white text-center">
      <div className="p-10 bg-white/20 rounded-[3rem] animate-bounce shadow-2xl backdrop-blur-md"><Sprout size={80} /></div>
      <h1 className="text-6xl font-black mt-10 tracking-tighter">AI कृषी मित्र</h1>
      <p className="mt-4 text-emerald-100 font-bold uppercase tracking-widest text-xs">Modern Farming Ecosystem</p>
    </div>
  );
};

const LanguageSelection = ({ onSelect }: { onSelect: (l: Language) => void }) => (
  <div className="h-full bg-stone-50 flex flex-col items-center justify-center p-8 space-y-6">
    <div className="w-24 h-24 bg-emerald-600 rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl text-white"><Radio size={48}/></div>
    <h2 className="text-4xl font-black text-stone-900 mb-10 tracking-tight">निवडा तुमची भाषा</h2>
    {['mr', 'hi', 'en'].map(l => (
      <button key={l} onClick={() => onSelect(l as Language)} className="w-full max-w-md p-8 bg-white border border-stone-200 rounded-[2.5rem] text-3xl font-black text-stone-900 hover:bg-emerald-600 hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-xl">
        {l === 'mr' ? 'मराठी' : l === 'hi' ? 'हिन्दी' : 'English'}
      </button>
    ))}
  </div>
);
