import React, { useState, useCallback, useEffect, Component, ReactNode, ErrorInfo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { 
  BarChart,
  ComposedChart,
  Line,
  Area,
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Camera, 
  Upload, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  Laptop, 
  RefreshCcw,
  X,
  XCircle,
  Loader2,
  ShieldCheck,
  Info,
  User,
  LogOut,
  History,
  Shield,
  Download,
  Plus,
  ArrowRight,
  ExternalLink,
  ShoppingBag,
  DollarSign,
  Wrench,
  MessageSquare,
  Activity,
  LayoutGrid,
  FileText,
  Mail,
  Zap,
  Target,
  Send,
  Lock,
  Globe,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  analyzeLaptopImage, 
  analyzeSitePrintComponent, 
  getSupportResponse,
  type AnalysisResult, 
  type SitePrintAnalysisResult 
} from './services/geminiService';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc, 
  doc, 
  limit,
  setDoc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends Component<any, any> {
  state: any;
  props: any;

  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          message = "You don't have permission to perform this action. Please check your account type.";
        }
      } catch (e) {}

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-hp-dark">Application Error</h2>
            <p className="text-slate-600">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-hp-blue text-white rounded-full font-bold hover:bg-hp-blue/90 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const HP_MODELS = [
  "HP Spectre x360",
  "HP Envy",
  "HP Pavilion",
  "HP EliteBook",
  "HP ProBook",
  "HP OMEN",
  "HP Victus",
  "HP ZBook"
];

const MODEL_PRICES: Record<string, number> = {
  "HP Spectre x360": 1499,
  "HP Envy": 1099,
  "HP Pavilion": 799,
  "HP EliteBook": 1299,
  "HP ProBook": 899,
  "HP OMEN": 1699,
  "HP Victus": 999,
  "HP ZBook": 2499
};

const HP_LOGO = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/HP_logo_2025.svg/500px-HP_logo_2025.png";

const CURRENCY_CONFIG: Record<string, { symbol: string; rate: number; code: string }> = {
  "United States": { symbol: "$", rate: 1.0, code: "USD" },
  "United Kingdom": { symbol: "£", rate: 0.78, code: "GBP" },
  "Canada": { symbol: "C$", rate: 1.35, code: "CAD" },
  "Australia": { symbol: "A$", rate: 1.52, code: "AUD" },
  "Germany": { symbol: "€", rate: 0.92, code: "EUR" },
  "France": { symbol: "€", rate: 0.92, code: "EUR" },
  "Spain": { symbol: "€", rate: 0.92, code: "EUR" },
  "Italy": { symbol: "€", rate: 0.92, code: "EUR" },
  "Finland": { symbol: "€", rate: 0.92, code: "EUR" },
  "Japan": { symbol: "¥", rate: 150.0, code: "JPY" },
  "China": { symbol: "¥", rate: 7.2, code: "CNY" },
  "India": { symbol: "₹", rate: 82.0, code: "INR" },
  "Brazil": { symbol: "R$", rate: 5.0, code: "BRL" },
  "Mexico": { symbol: "$", rate: 17.0, code: "MXN" },
  "Norway": { symbol: "kr", rate: 10.5, code: "NOK" },
  "Sweden": { symbol: "kr", rate: 10.3, code: "SEK" },
  "Iceland": { symbol: "kr", rate: 138.0, code: "ISK" }
};

const DEFAULT_CURRENCY = { symbol: "$", rate: 1.0, code: "USD" };
const LAPTOP_HERO = "https://image2url.com/r2/default/images/1773303235305-b32f642c-dba8-4178-9290-32f874998e14.png";
const SITEPRINT_INKJET = "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&q=80&w=1000";
const SITEPRINT_HERO = "https://www.instop.biz/blog/wp-content/uploads/2025/01/HP-SitePrint-ACCIONA-lifestyle-image-08-scaled-1.jpeg";
interface UserProfile {
  id: number;
  email: string;
  name: string;
  country: string;
  role: string;
}

interface InspectionRecord {
  id: number;
  model: string;
  date: string;
  results: AnalysisResult | SitePrintAnalysisResult;
  summary: string;
  overall_health: string;
  inspection_type?: 'laptop' | 'siteprint';
}

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

interface FleetDevice {
  id: string;
  name: string;
  type: 'laptop' | 'siteprint';
  health: number;
  lastInspection: string;
  nextService: string;
  status: 'online' | 'offline' | 'maintenance';
  remainingLife?: number;
}

const SCAN_STEPS = [
  "Initializing AI diagnostic engine...",
  "Calibrating optical sensors...",
  "Analyzing surface textures...",
  "Detecting structural anomalies...",
  "Cross-referencing model specifications...",
  "Calculating repair estimates...",
  "Finalizing health assessment..."
];

function ScanningOverlay({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-2xl">
      <motion.div 
        className="absolute inset-x-0 h-1 bg-hp-blue shadow-[0_0_20px_rgba(0,150,214,1)] z-30"
        initial={{ top: "-5%" }}
        animate={{ top: "105%" }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
      />
      <motion.div 
        className="absolute inset-0 bg-hp-blue/10 backdrop-blur-[2px]"
        animate={{ opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-full border-2 border-hp-blue/30 rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}

function Hotspot({ x, y, width, height, title, description }: { x: number; y: number; width: number; height: number; title: string; description: string; key?: React.Key }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div 
      className="absolute z-30 group"
      style={{ 
        left: `${x/10}%`, 
        top: `${y/10}%`,
        width: `${width/10}%`,
        height: `${height/10}%`,
        minWidth: '20px',
        minHeight: '20px'
      }}
    >
      <div 
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-full border-2 border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.3)] rounded-sm transition-all hover:bg-red-500/20 cursor-help"
      />
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 w-48 p-3 bg-white rounded-xl shadow-xl border border-slate-200 pointer-events-none"
          >
            <p className="text-xs font-bold text-hp-dark mb-1">{title}</p>
            <p className="text-[10px] text-slate-500 leading-tight break-words">{description}</p>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-b border-r border-slate-200 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const [step, setStep] = useState(0); // 0: Hero, 1: Model/Type, 2: Upload, 3: Analysis, 4: Profile, 5: Fleet
  const [inspectionMode, setInspectionMode] = useState<'laptop' | 'siteprint'>('laptop');
  const [selectedModel, setSelectedModel] = useState("");
  const [images, setImages] = useState<{ 
    file: File; 
    preview: string; 
    result?: AnalysisResult; 
    sitePrintResult?: SitePrintAnalysisResult;
    loading?: boolean; 
    error?: string;
    currentStep?: string;
  }[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSupportBot, setShowSupportBot] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'ai', content: 'Hello! I am your HP Support AI. How can I help you today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '', country: 'United States' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [technicianStats, setTechnicianStats] = useState<(AnalysisResult & { model: string, country: string })[]>([]);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  const [combinedResult, setCombinedResult] = useState<AnalysisResult | null>(null);
  const [combinedSitePrintResult, setCombinedSitePrintResult] = useState<SitePrintAnalysisResult | null>(null);
  const [combinedError, setCombinedError] = useState<string | null>(null);
  const [lastInspectionId, setLastInspectionId] = useState<number | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');

  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Fetch additional user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              id: firebaseUser.uid as any,
              email: firebaseUser.email || '',
              name: userData.name || firebaseUser.displayName || 'User',
              country: userData.country || 'United States',
              role: userData.role || 'user'
            });
          } else {
            setUser({
              id: firebaseUser.uid as any,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'User',
              country: 'United States',
              role: 'user'
            });
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth state change error:", error);
        if (firebaseUser) {
          setUser({
            id: firebaseUser.uid as any,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'User',
            country: 'United States',
            role: 'user'
          });
        } else {
          setUser(null);
        }
      } finally {
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  const currency = user?.country ? (CURRENCY_CONFIG[user.country] || DEFAULT_CURRENCY) : DEFAULT_CURRENCY;

  const formatPrice = (usdAmount: number) => {
    const converted = usdAmount * currency.rate;
    return `${currency.symbol}${Math.round(converted).toLocaleString()}`;
  };

  // Profile Data
  const [pastInspections, setPastInspections] = useState<InspectionRecord[]>([]);
  const [manuallyRegisteredDevices, setManuallyRegisteredDevices] = useState<any[]>([]);
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [newDevice, setNewDevice] = useState({ model: '', serialNumber: '', purchaseDate: '', type: 'laptop' });

  const [fleet, setFleet] = useState<FleetDevice[]>([
    { id: '1', name: 'Main Office EliteBook', type: 'laptop', health: 92, lastInspection: '2024-03-01', nextService: '2024-09-01', status: 'online' },
    { id: '2', name: 'Warehouse SitePrint A', type: 'siteprint', health: 78, lastInspection: '2024-02-15', nextService: '2024-05-15', status: 'online' },
    { id: '3', name: 'Design Studio ZBook', type: 'laptop', health: 45, lastInspection: '2024-03-05', nextService: '2024-03-10', status: 'maintenance' },
  ]);

  useEffect(() => {
    const newFleetFromInspections: FleetDevice[] = pastInspections.map(insp => {
      let healthValue = 100;
      const healthStr = String(insp.overall_health);
      if (healthStr.includes('%')) {
        healthValue = parseInt(healthStr);
      } else {
        const healthMap: Record<string, number> = { 
          'Excellent': 95, 'Good': 85, 'Fair': 65, 'Poor': 45, 'Critical': 25,
          'New': 100, 'Like New': 95, 'Used - Good': 80, 'Used - Fair': 60, 'Used - Poor': 40
        };
        healthValue = healthMap[healthStr] || 100;
      }
      
      return {
        id: insp.id.toString(),
        name: insp.model,
        type: insp.inspection_type || 'laptop',
        health: healthValue,
        lastInspection: new Date(insp.date).toLocaleDateString(),
        nextService: new Date(new Date(insp.date).getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: healthValue < 50 ? 'maintenance' : 'online',
        remainingLife: insp.results?.estimatedRemainingLifeYears || 5
      };
    });

    const newFleetFromManual: FleetDevice[] = manuallyRegisteredDevices.map(dev => ({
      id: `manual-${dev.id}`,
      name: dev.model,
      type: dev.device_type || 'laptop',
      health: 100,
      lastInspection: 'Never',
      nextService: 'Pending Inspection',
      status: dev.status || 'online',
      remainingLife: 5
    }));

    // Combine and deduplicate by name, preferring inspection data if it exists
    const combined = [...newFleetFromInspections, ...newFleetFromManual];
    const uniqueMap = new Map();
    
    combined.forEach(device => {
      if (!uniqueMap.has(device.name) || device.lastInspection !== 'Never') {
        uniqueMap.set(device.name, device);
      }
    });
    
    setFleet(Array.from(uniqueMap.values()));
  }, [pastInspections, manuallyRegisteredDevices]);
  const [selectedInspection, setSelectedInspection] = useState<InspectionRecord | null>(null);
  const [footerSection, setFooterSection] = useState<'privacy' | 'terms' | 'support' | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfileData();
    }
  }, [user]);

  const fetchProfileData = async () => {
    if (!user) return;
    try {
      // Fetch inspections
      const qInsp = query(
        collection(db, 'inspections'),
        where('userId', '==', user.id),
        orderBy('date', 'desc')
      );
      const inspSnap = await getDocs(qInsp);
      const inspections = inspSnap.docs.map(doc => ({
        id: doc.id as any,
        ...doc.data()
      })) as any[];
      setPastInspections(inspections);

      // Fetch devices
      const qDev = query(
        collection(db, 'devices'),
        where('userId', '==', user.id)
      );
      const devSnap = await getDocs(qDev);
      const devices = devSnap.docs.map(doc => ({
        id: doc.id as any,
        ...doc.data()
      })) as any[];
      setManuallyRegisteredDevices(devices);
    } catch (err) {
      console.error("Failed to fetch profile data", err);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newImages = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      loading: false
    }));
    setImages(prev => [...prev, ...newImages]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: true
  } as any);

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleAnalyze = async () => {
    if (images.length === 0) return;
    setIsAnalyzing(true);
    setStep(3);

    setCombinedResult(null);
    setCombinedSitePrintResult(null);
    setCombinedError(null);

    const updatedImages = [...images];
    
    // Mark all as loading
    updatedImages.forEach(img => {
      img.loading = true;
      img.currentStep = SCAN_STEPS[0];
      img.error = undefined; // Clear individual errors
      img.result = undefined;
      img.sitePrintResult = undefined;
    });
    setImages([...updatedImages]);

    // Simulate real-time progress steps for all
    for (const stepText of SCAN_STEPS) {
      updatedImages.forEach(img => img.currentStep = stepText);
      setImages([...updatedImages]);
      await new Promise(r => setTimeout(r, 600));
    }

    try {
      // Fetch recent feedback to learn from
      let feedbackContext = "";
      try {
        const qFeedback = query(collection(db, 'feedback'), orderBy('date', 'desc'), limit(10));
        const feedbackSnap = await getDocs(qFeedback);
        const recentFeedback = feedbackSnap.docs.map(doc => doc.data());
        if (recentFeedback.length > 0) {
          feedbackContext = recentFeedback.map((f: any) => 
            `- Inspection: User said it was ${f.isCorrect ? "CORRECT" : "INCORRECT"}. ${f.comment ? `Comment: ${f.comment}` : ""}`
          ).join("\n");
        }
      } catch (fErr) {
        console.warn("Failed to fetch feedback context", fErr);
      }

      const base64s = await Promise.all(updatedImages.map(img => fileToBase64(img.file)));
      let result;
      if (inspectionMode === 'laptop') {
        result = await analyzeLaptopImage(base64s, selectedModel, feedbackContext);
        if (result.isHPProduct && result.matchesModel) {
          result.originalPrice = MODEL_PRICES[selectedModel] || result.originalPrice;
        }
        setCombinedResult(result);
      } else {
        result = await analyzeSitePrintComponent(base64s, feedbackContext);
        setCombinedSitePrintResult(result);
      }
      
      // Check for errors in the combined result
      if (result.isBlurry) {
        setCombinedError(result.blurReason || "One or more images are too blurry to analyze.");
      } else if (!result.isHPProduct) {
        setCombinedError(inspectionMode === 'laptop' 
          ? "This device does not appear to be an HP laptop. Our diagnostic tools are exclusively calibrated for genuine HP hardware to ensure accuracy."
          : "This component does not appear to belong to an HP SitePrint system.");
      } else if (inspectionMode === 'laptop' && !result.matchesModel) {
        setCombinedError(result.mismatchReason || `The detected device does not match the selected model (${selectedModel}). Please ensure you have selected the correct model for a precise diagnostic.`);
      }

      // Mark all as done
      updatedImages.forEach(img => {
        img.loading = false;
      });
      setImages([...updatedImages]);

      if (result.isHPProduct && (inspectionMode !== 'laptop' || result.matchesModel)) {
        // Save to Firestore
        try {
          const docRef = await addDoc(collection(db, 'inspections'), {
            userId: user?.id || 'anonymous',
            model: inspectionMode === 'laptop' ? selectedModel : `HP SitePrint ${result.componentType || 'Component'}`,
            results: result,
            summary: result.summary,
            overallHealth: inspectionMode === 'laptop' ? (result as any).overallHealth : (result as any).condition,
            inspectionType: inspectionMode,
            date: new Date().toISOString(),
            country: user?.country || 'Unknown'
          });
          setLastInspectionId(docRef.id as any);
          setShowFeedbackForm(true);
          setFeedbackSubmitted(false);
        } catch (saveErr) {
          console.error("Error saving inspection to Firestore:", saveErr);
        }
      }
    } catch (err) {
      console.error(err);
      setCombinedError("Analysis failed. Please try again.");
      updatedImages.forEach(img => {
        img.loading = false;
      });
      setImages([...updatedImages]);
    } finally {
      setIsAnalyzing(false);
      if (user) fetchProfileData();
    }
  };

  const submitFeedback = async (isCorrect: boolean) => {
    if (!lastInspectionId) return;
    try {
      await addDoc(collection(db, 'feedback'), {
        inspectionId: lastInspectionId,
        userId: user?.id || 'anonymous',
        isCorrect: isCorrect,
        comment: feedbackComment,
        date: new Date().toISOString()
      });
      setFeedbackSubmitted(true);
      setShowFeedbackForm(false);
      setFeedbackComment('');
    } catch (err) {
      console.error("Failed to submit feedback", err);
    }
  };

  const fetchTechnicianStats = async () => {
    setIsStatsLoading(true);
    try {
      const q = query(collection(db, 'inspections'), where('inspectionType', '==', 'laptop'));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => doc.data());
      setTechnicianStats(data as any);
    } catch (err) {
      console.error("Failed to fetch technician stats", err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  const TechnicianDashboard = () => {
    const normalizeErrorType = (type: string): string => {
      const t = type.toLowerCase();
      if (t.includes('screen') || t.includes('lcd') || t.includes('display') || t.includes('pixel')) return 'Screen Damage';
      if (t.includes('keyboard') || t.includes('key')) return 'Keyboard Issues';
      if (t.includes('chassis') || t.includes('shell') || t.includes('case') || t.includes('scratch') || t.includes('dent') || t.includes('enclosure')) return 'Chassis/Shell Damage';
      if (t.includes('hinge')) return 'Hinge Issues';
      if (t.includes('port') || t.includes('usb') || t.includes('hdmi') || t.includes('charging') || t.includes('connector')) return 'Port/Connectivity Issues';
      if (t.includes('battery') || t.includes('power') || t.includes('swelling')) return 'Battery/Power Issues';
      if (t.includes('touchpad') || t.includes('trackpad') || t.includes('mouse')) return 'Touchpad Issues';
      if (t.includes('audio') || t.includes('speaker') || t.includes('sound') || t.includes('mic')) return 'Audio/Speaker Issues';
      if (t.includes('webcam') || t.includes('camera')) return 'Webcam Issues';
      if (t.includes('fan') || t.includes('thermal') || t.includes('heat') || t.includes('overheating')) return 'Thermal/Fan Issues';
      if (t.includes('inkjet') || t.includes('printhead') || t.includes('clog') || t.includes('leak') || t.includes('nozzle')) return 'Inkjet/Printhead Issues';
      if (t.includes('sensor')) return 'Sensor Issues';
      return 'Other Issues';
    };

    // Process data for charts
    const issueCounts: Record<string, number> = {};
    const modelIssues: Record<string, Record<string, number>> = {};
    const countryIssues: Record<string, Record<string, number>> = {};
    const climateIssues: Record<string, Record<string, number>> = {};

    const CLIMATE_MAP: Record<string, string[]> = {
      "Spain": ["Hot", "Humid"],
      "India": ["Hot", "Humid"],
      "USA": ["Humid"],
      "UK": ["Humid"],
      "Canada": ["Cold", "Dry"],
      "Norway": ["Cold", "Dry"],
      "Brazil": ["Hot", "Humid"],
      "Australia": ["Hot", "Dry"],
      "Germany": ["Humid"],
      "France": ["Humid"],
      "Italy": ["Hot", "Humid"],
      "Japan": ["Humid"],
      "China": ["Humid"],
      "Mexico": ["Hot", "Dry"]
    };

    technicianStats.forEach(stat => {
      const model = stat.model;
      const country = stat.country || "Unknown";
      const climates = CLIMATE_MAP[country] || [];
      const results = stat.results;

      const errors = results.errors || results.detectedIssues || [];

      errors.forEach((err: any) => {
        const type = normalizeErrorType(err.type);
        issueCounts[type] = (issueCounts[type] || 0) + 1;

        if (!modelIssues[model]) modelIssues[model] = {};
        modelIssues[model][type] = (modelIssues[model][type] || 0) + 1;

        if (country !== "Unknown") {
          if (!countryIssues[country]) countryIssues[country] = {};
          countryIssues[country][type] = (countryIssues[country][type] || 0) + 1;

          climates.forEach(climate => {
            if (!climateIssues[climate]) climateIssues[climate] = {};
            climateIssues[climate][type] = (climateIssues[climate][type] || 0) + 1;
          });
        }
      });
    });

    const issueData = Object.entries(issueCounts).map(([name, value]) => ({ name, value }));
    const modelData = Object.entries(modelIssues).map(([model, issues]) => ({
      model,
      ...issues
    }));

    const COLORS = ['#0096D6', '#64748b', '#8da399', '#d4b483', '#c1666b', '#4e596f'];

    const scatterData = technicianStats.map(stat => ({
      imperfections: stat.results?.errors?.length || 0,
      value: (stat.results?.estimatedResaleValue || 0) * currency.rate,
      model: stat.model
    })).filter(d => d.value > 0);

    // Regression Line Calculation
    let regressionData: any[] = [];
    if (scatterData.length > 1) {
      const n = scatterData.length;
      const sumX = scatterData.reduce((acc, d) => acc + d.imperfections, 0);
      const sumY = scatterData.reduce((acc, d) => acc + d.value, 0);
      const sumXY = scatterData.reduce((acc, d) => acc + (d.imperfections * d.value), 0);
      const sumX2 = scatterData.reduce((acc, d) => acc + (d.imperfections * d.imperfections), 0);

      const denominator = (n * sumX2 - sumX * sumX);
      if (denominator !== 0) {
        const m = (n * sumXY - sumX * sumY) / denominator;
        const b = (sumY - m * sumX) / n;

        const minX = Math.min(...scatterData.map(d => d.imperfections));
        const maxX = Math.max(...scatterData.map(d => d.imperfections));

        regressionData = [
          { imperfections: minX, value: m * minX + b },
          { imperfections: maxX, value: m * maxX + b }
        ];
      }
    }

    return (
      <div className="space-y-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-4xl font-bold text-hp-dark tracking-tight">Technician Dashboard</h2>
            <p className="text-slate-500 mt-2">Aggregated laptop diagnostic data for fleet health monitoring.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-hp-blue/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-hp-blue" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Reports</p>
                <p className="text-xl font-bold text-hp-dark">{technicianStats.length}</p>
              </div>
            </div>
            <button 
              onClick={fetchTechnicianStats}
              className="p-4 bg-hp-dark text-white rounded-2xl hover:opacity-90 transition-opacity"
            >
              <RefreshCcw className={cn("w-6 h-6", isStatsLoading && "animate-spin")} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Issue Frequency Chart */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Most Frequent Failures
              </h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={issueData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""}
                  >
                    {issueData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '10px', paddingTop: '20px'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Model Breakdown Chart */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Laptop className="w-5 h-5 text-hp-blue" />
                Failure by Model
              </h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={modelData.map(m => ({
                      name: m.model,
                      value: Object.entries(m).reduce((acc, [k, v]) => k !== 'model' ? acc + (v as any as number) : acc, 0)
                    }))}
                    cx="50%"
                    cy="45%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""}
                  >
                    {modelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '10px', paddingTop: '20px'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Common Failures per Model Chart */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Wrench className="w-5 h-5 text-hp-blue" />
                Common Failures per Model
              </h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="model" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '10px', paddingTop: '20px'}} />
                  {Object.keys(issueCounts).map((key, index) => (
                    <Bar key={key} dataKey={key} stackId="a" fill={COLORS[index % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Value Retention vs. Damage Severity Chart */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Target className="w-5 h-5 text-hp-blue" />
                Value Retention vs. Damage Severity
              </h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    type="number" 
                    dataKey="imperfections" 
                    name="Imperfections" 
                    unit="" 
                    label={{ value: 'Number of Imperfections', position: 'insideBottom', offset: -10, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tick={{fontSize: 10, fill: '#64748b'}}
                    allowDecimals={false}
                    domain={[0, 'auto']}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="value" 
                    name="Value" 
                    unit={currency.symbol} 
                    label={{ value: `Estimated Value (${currency.code})`, angle: -90, position: 'insideLeft', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tick={{fontSize: 10, fill: '#64748b'}}
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    formatter={(value: any, name: any) => [name === 'Value' ? `${currency.symbol}${Math.round(value).toLocaleString()}` : value, name]}
                  />
                  <Scatter name="Inspections" data={scatterData} fill="#0096D6" fillOpacity={0.4} />
                  {regressionData.length > 0 && (
                    <Line 
                      data={regressionData} 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#000000" 
                      strokeWidth={2} 
                      dot={false} 
                      activeDot={false}
                      legendType="none"
                      tooltipType="none"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Climate Impact Chart */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Globe className="w-5 h-5 text-hp-blue" />
                Climate & Regional Impact Analysis
              </h3>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Weather-Related Correlation</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="h-[400px] space-y-4">
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Most Common Failures by Country</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={Object.entries(countryIssues).map(([country, issues]) => ({ 
                    country, 
                    total: Object.values(issues).reduce((a, b) => a + b, 0),
                    ...issues 
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="country" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                    <Tooltip 
                      contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '10px', paddingTop: '20px'}} />
                    {Object.keys(issueCounts).map((key, index) => (
                      <Bar key={key} dataKey={key} stackId="a" fill={COLORS[index % COLORS.length]} />
                    ))}
                    <Line type="monotone" dataKey="total" stroke="#000" strokeWidth={2} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="h-[400px] space-y-4">
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Failures by Climate Condition</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={Object.entries(climateIssues).map(([climate, issues]) => ({ 
                    climate, 
                    total: Object.values(issues).reduce((a, b) => a + b, 0),
                    ...issues 
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="climate" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                    <Tooltip 
                      contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    />
                    <Legend iconType="circle" wrapperStyle={{fontSize: '10px', paddingTop: '20px'}} />
                    {Object.keys(issueCounts).map((key, index) => (
                      <Bar key={key} dataKey={key} stackId="a" fill={COLORS[index % COLORS.length]} />
                    ))}
                    <Line type="monotone" dataKey="total" stroke="#000" strokeWidth={2} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    
    const email = authForm.email.trim();
    const password = authForm.password.trim();

    try {
      if (authMode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setResetSent(true);
        setAuthLoading(false);
        return;
      }

      if (authMode === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        
        // Repair Firestore doc if it's missing (half-created account recovery)
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (!userDoc.exists()) {
            const role = (email.endsWith('@hp.com') || email === 'roger.torrents@estudiantat.upc.edu') ? 'technician' : 'user';
            await setDoc(doc(db, 'users', firebaseUser.uid), {
              uid: firebaseUser.uid,
              email: email,
              name: authForm.name.trim() || firebaseUser.displayName || 'User',
              country: authForm.country || 'United States',
              role: role
            });
          }
        } catch (repairErr) {
          console.warn("Profile repair failed, but continuing login:", repairErr);
        }
      } else {
        console.log("Attempting to register:", email);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        
        const role = (email.endsWith('@hp.com') || email === 'roger.torrents@estudiantat.upc.edu') ? 'technician' : 'user';
        
        // Create user doc in Firestore
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          uid: firebaseUser.uid,
          email: email,
          name: authForm.name.trim(),
          country: authForm.country,
          role: role
        });

        await updateProfile(firebaseUser, { displayName: authForm.name.trim() });
      }
      setShowAuthModal(false);
    } catch (err: any) {
      console.error("Auth error details:", err.code, err.message);
      let message = 'Authentication failed';
      
      if (err.code === 'auth/email-already-in-use') {
        message = `The email "${email}" is already registered in your private project. This usually happens if a previous attempt succeeded in creating the account but was interrupted. Please try to "Sign In" instead using the password you chose. If you don't remember it, use the "Forgot Password" link.`;
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        message = 'Invalid email or password. If you forgot your password, use the "Forgot Password" link.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password must be at least 6 characters long.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (err.code === 'auth/user-disabled') {
        message = 'This account has been disabled.';
      } else {
        message = `[${err.code}] ${err.message || 'An unexpected error occurred.'}`;
      }
      
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setStep(0);
  };

  const downloadReport = async () => {
    const doc = new jsPDF();
    const primaryColor = [0, 150, 214]; // HP Blue
    const darkColor = [20, 20, 20];
    const lightGray = [245, 245, 245];
    
    // Helper to add header to every page
    const addHeader = (pageDoc: any, isFirstPage: boolean) => {
      pageDoc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pageDoc.rect(0, 0, 210, 40, 'F');
      
      // Add HP Logo (White version or just the logo)
      pageDoc.setFillColor(255, 255, 255);
      pageDoc.circle(185, 20, 12, 'F');
      try {
        pageDoc.addImage(HP_LOGO, 'PNG', 177, 12, 16, 16);
      } catch (e) {
        pageDoc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        pageDoc.setFontSize(12);
        pageDoc.setFont('helvetica', 'bold');
        pageDoc.text('hp', 182, 22);
      }
      
      pageDoc.setTextColor(255, 255, 255);
      pageDoc.setFontSize(22);
      pageDoc.setFont('helvetica', 'bold');
      pageDoc.text('HORUS AI', 20, 22);
      
      pageDoc.setFontSize(10);
      pageDoc.setFont('helvetica', 'normal');
      pageDoc.text('DIAGNOSTIC & MAINTENANCE REPORT', 20, 30);
      
      if (isFirstPage) {
        pageDoc.setFontSize(8);
        pageDoc.text(`Generated: ${new Date().toLocaleString()}`, 20, 36);
      }
    };

    addHeader(doc, true);
    
    let y = 55;
    
    // Title Section
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const title = inspectionMode === 'laptop' ? `Device: ${selectedModel}` : `Component: HP SitePrint Inkjet System`;
    doc.text(title, 20, y);
    
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(20, y + 2, 190, y + 2);
    y += 15;

    if (combinedError) {
      doc.setFillColor(254, 242, 242);
      doc.rect(20, y, 170, 20, 'F');
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(12);
      doc.text(`Status: Validation Failed`, 25, y + 8);
      doc.setFontSize(10);
      doc.setTextColor(153, 27, 27);
      doc.text(`Reason: ${combinedError}`, 25, y + 14);
      y += 30;
    } else {
      const res = inspectionMode === 'laptop' ? combinedResult : combinedSitePrintResult;
      if (res) {
        // Condition Summary Card
        doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
        doc.rect(20, y, 170, 35, 'F');
        
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        const health = inspectionMode === 'laptop' ? combinedResult?.overallHealth : combinedSitePrintResult?.condition;
        doc.text(`Overall Health Status: ${health}`, 25, y + 10);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        const splitSummary = doc.splitTextToSize(res.summary || '', 160);
        doc.text(splitSummary, 25, y + 18);
        y += 45;
        
        if (inspectionMode === 'laptop' && combinedResult) {
          // Financials
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.setFont('helvetica', 'bold');
          doc.text('Financial & Lifecycle Analysis', 20, y);
          y += 8;
          
          doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
          doc.setFont('helvetica', 'normal');
          doc.text(`• Total Estimated Repair Cost: ${formatPrice(combinedResult.totalRepairCost)}`, 25, y);
          y += 6;
          doc.text(`• Estimated Resale Value: ${formatPrice(combinedResult.estimatedResaleValue)}`, 25, y);
          y += 6;
          doc.text(`• Remaining Useful Life: ${combinedResult.estimatedRemainingLifeYears} Years`, 25, y);
          y += 15;
          
          // Issues
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.setFont('helvetica', 'bold');
          doc.text('Detected Physical Issues', 20, y);
          y += 8;
          
          combinedResult.errors.forEach(err => {
            if (y > 260) { doc.addPage(); addHeader(doc, false); y = 55; }
            doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
            doc.setFont('helvetica', 'bold');
            doc.text(`• ${err.type}`, 25, y);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(`  ${err.description} | Cost: ${formatPrice(err.repairCost)}`, 25, y + 5);
            y += 12;
          });
        } else if (combinedSitePrintResult) {
          // Technical
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.setFont('helvetica', 'bold');
          doc.text('Technical System Analysis', 20, y);
          y += 8;
          
          doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
          doc.setFont('helvetica', 'normal');
          doc.text(`• Component Type: ${combinedSitePrintResult.componentType}`, 25, y);
          y += 6;
          doc.text(`• Wear/Clog Level: ${combinedSitePrintResult.wearLevel}%`, 25, y);
          y += 6;
          doc.text(`• Remaining Life: ${combinedSitePrintResult.estimatedRemainingLifeYears} Years`, 25, y);
          y += 6;
          doc.text(`• Maintenance Required: ${combinedSitePrintResult.repairNeeded ? 'YES' : 'NO'}`, 25, y);
          y += 15;

          // Issues
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.setFont('helvetica', 'bold');
          doc.text('Detected Maintenance Issues', 20, y);
          y += 8;
          
          combinedSitePrintResult.detectedIssues.forEach(issue => {
            if (y > 260) { doc.addPage(); addHeader(doc, false); y = 55; }
            doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
            doc.setFont('helvetica', 'bold');
            doc.text(`• ${issue.type} [${issue.severity}]`, 25, y);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(`  ${issue.description}`, 25, y + 5);
            y += 12;
          });
          y += 10;

          if (combinedSitePrintResult.manualRepairRecommendations?.length > 0) {
            if (y > 240) { doc.addPage(); addHeader(doc, false); y = 55; }
            doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
            doc.setFont('helvetica', 'bold');
            doc.text('Manual Repair Recommendations', 20, y);
            y += 8;
            
            combinedSitePrintResult.manualRepairRecommendations.forEach(rec => {
              const recText = `• ${rec}`;
              const splitRec = doc.splitTextToSize(recText, 160);
              if (y + (splitRec.length * 5) > 275) { doc.addPage(); addHeader(doc, false); y = 55; }
              doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
              doc.setFont('helvetica', 'normal');
              doc.text(splitRec, 25, y);
              y += (splitRec.length * 5) + 2;
            });
          }
        }
      }
    }
    
    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(230, 230, 230);
      doc.line(20, 280, 190, 280);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pageCount} | Horus AI Diagnostic System | Confidential`, 105, 287, { align: 'center' });
    }
    
    const fileName = inspectionMode === 'laptop' ? selectedModel : 'HP_SitePrint_Component';
    doc.save(`HP_Horus_Report_${fileName.replace(/\s+/g, '_')}.pdf`);
  };

  const reset = () => {
    setStep(0);
    setSelectedModel("");
    setImages([]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setIsChatLoading(true);

    // Construct context
    let context = `The user is currently on step ${step} of the application. `;
    if (step === 3) {
      context += `They are viewing the analysis results for a ${inspectionMode === 'laptop' ? selectedModel : 'HP SitePrint component'}. `;
      if (combinedError) {
        context += `Analysis failed with error: ${combinedError}. `;
      } else if (inspectionMode === 'laptop' && combinedResult) {
        context += `Combined Analysis (Laptop): Health ${combinedResult.overallHealth}, Summary: ${combinedResult.summary}, Issues: ${combinedResult.errors.map(e => e.type).join(', ')}. Total Repair Cost: ${formatPrice(combinedResult.totalRepairCost)}, Resale Value: ${formatPrice(combinedResult.estimatedResaleValue)}. `;
      } else if (combinedSitePrintResult) {
        context += `Combined Analysis (SitePrint): Condition ${combinedSitePrintResult.condition}, Component: ${combinedSitePrintResult.componentType}, Summary: ${combinedSitePrintResult.summary}, Issues: ${combinedSitePrintResult.detectedIssues.map(i => i.type).join(', ')}. `;
        if (combinedSitePrintResult.manualRepairRecommendations?.length > 0) {
          context += `Recommendations: ${combinedSitePrintResult.manualRepairRecommendations.join('; ')}. `;
        }
      }
    } else {
      const sectionNames = ['Hero', 'Model Selection', 'Upload', 'Analysis', 'Profile', 'Fleet'];
      context += `They are in the ${sectionNames[step] || 'Unknown'} section.`;
    }

    try {
      const response = await getSupportResponse(userMsg, context);
      setChatMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'ai', content: "I'm sorry, I'm having trouble connecting right now." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

      {/* Support Bot */}
      <div className="fixed bottom-6 right-6 z-[100]">
        <AnimatePresence>
          {showSupportBot && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="absolute bottom-20 right-0 w-80 sm:w-96 h-[500px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
            >
              <div className="p-4 bg-hp-blue text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold">HP Support AI</p>
                    <p className="text-[10px] opacity-80 uppercase tracking-widest">Always Online</p>
                  </div>
                </div>
                <button onClick={() => setShowSupportBot(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 scrollbar-hide">
                {chatMessages.map((msg, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}
                  >
                    <div className={cn(
                      "max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed",
                      msg.role === 'user' ? "bg-hp-blue text-white rounded-tr-none shadow-lg shadow-hp-blue/20" : "bg-white text-slate-700 shadow-sm border border-slate-100 rounded-tl-none"
                    )}>
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-100">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-hp-blue rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-hp-blue rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1.5 h-1.5 bg-hp-blue rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex gap-2">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-hp-blue"
                />
                <button type="submit" className="p-2 bg-hp-blue text-white rounded-full hover:bg-hp-blue/90 transition-colors">
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
        <button 
          onClick={() => setShowSupportBot(!showSupportBot)}
          className="w-14 h-14 bg-hp-blue text-white rounded-full shadow-xl shadow-hp-blue/40 flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
        >
          {showSupportBot ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        </button>
      </div>

      {/* Auth Modal */}

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      await addDoc(collection(db, 'devices'), {
        userId: user.id,
        model: newDevice.model,
        serialNumber: newDevice.serialNumber,
        purchaseDate: newDevice.purchaseDate,
        deviceType: newDevice.type,
        status: 'online'
      });
      
      setShowAddDeviceModal(false);
      setNewDevice({ model: '', serialNumber: '', purchaseDate: '', type: 'laptop' });
      fetchProfileData();
    } catch (error) {
      console.error("Error registering device:", error);
    }
  };

  function FleetDashboard() {
    if (!user) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
            <Lock className="w-10 h-10 text-slate-400" />
          </div>
          <div className="max-w-md space-y-2">
            <h2 className="text-2xl font-bold text-hp-dark">Account Required</h2>
            <p className="text-slate-500">Please sign in to access your personalized HP Fleet Management dashboard and monitor your devices.</p>
          </div>
          <button 
            onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
            className="px-8 py-3 bg-hp-blue text-white rounded-full font-bold shadow-lg shadow-hp-blue/20 hover:bg-hp-blue/90 transition-all"
          >
            Sign In to Continue
          </button>
        </div>
      );
    }

    // Use the global fleet state which is already combined and deduplicated
    const userFleet = fleet;

    const getRelativeMaintenance = (years: number) => {
      if (years <= 0) return "Immediate service required";
      if (years < 1) {
        const months = Math.max(1, Math.round(years * 12));
        return `in ${months} month${months !== 1 ? 's' : ''}`;
      }
      const roundedYears = Math.round(years);
      return `in ${roundedYears} year${roundedYears !== 1 ? 's' : ''}`;
    };

    const handleReAnalyze = (device: any) => {
      setInspectionMode(device.type);
      setSelectedModel(device.name.replace('HP SitePrint ', ''));
      setStep(2);
      setImages([]);
    };

    const handleDeleteDevice = async (device: any) => {
      if (!user) return;
      if (!confirm(`Are you sure you want to remove ${device.name} from your fleet? This will delete all inspection history for this device.`)) return;
      
      try {
        // Delete device doc
        const qDev = query(collection(db, 'devices'), where('userId', '==', user.id), where('model', '==', device.name));
        const devSnap = await getDocs(qDev);
        const deleteDevPromises = devSnap.docs.map(d => deleteDoc(doc(db, 'devices', d.id)));
        
        // Delete related inspections
        const qInsp = query(collection(db, 'inspections'), where('userId', '==', user.id), where('model', '==', device.name));
        const inspSnap = await getDocs(qInsp);
        const deleteInspPromises = inspSnap.docs.map(d => deleteDoc(doc(db, 'inspections', d.id)));

        await Promise.all([...deleteDevPromises, ...deleteInspPromises]);
        fetchProfileData();
      } catch (error) {
        console.error("Error deleting device:", error);
      }
    };

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-hp-dark">My Fleet Management</h2>
            <p className="text-slate-500 text-sm mt-1">Monitor and manage all your HP devices in one centralized dashboard.</p>
          </div>
          <button 
            onClick={() => setShowAddDeviceModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-hp-blue text-white rounded-full font-bold text-sm self-start md:self-auto"
          >
            <Plus className="w-4 h-4" /> Add Device
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {userFleet.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <LayoutGrid className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">No devices found in your fleet. Start an inspection to add your first device.</p>
                <button onClick={() => setStep(1)} className="text-hp-blue font-bold hover:underline">Start New Inspection</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {userFleet.map(device => (
                  <div key={device.id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between mb-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center",
                        device.type === 'laptop' ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                      )}>
                        {device.type === 'laptop' ? <Laptop className="w-6 h-6" /> : <RefreshCcw className="w-6 h-6" />}
                      </div>
                      <div className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                        device.status === 'online' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {device.status}
                      </div>
                      <button 
                        onClick={() => handleDeleteDevice(device)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50/50 rounded-lg transition-all ml-2"
                        title="Remove from fleet"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h3 className="font-bold text-lg text-hp-dark group-hover:text-hp-blue transition-colors">{device.name}</h3>
                    <p className="text-xs text-slate-500 mb-6">Last Inspection: {device.lastInspection}</p>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-500">Health Score</span>
                          <span className={cn(
                            device.health > 80 ? "text-emerald-500" : device.health > 50 ? "text-amber-500" : "text-red-500"
                          )}>{device.health}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${device.health}%` }}
                            className={cn(
                              "h-full rounded-full",
                              device.health > 80 ? "bg-emerald-500" : device.health > 50 ? "bg-amber-500" : "bg-red-500"
                            )}
                          />
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2 text-xs font-bold text-hp-dark mb-1">
                          <Activity className="w-3 h-3 text-hp-blue" />
                          Predictive Maintenance
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Next service recommended: <span className="font-bold text-hp-blue">{getRelativeMaintenance(device.remainingLife ?? 5)}</span>
                        </p>
                      </div>

                      <button 
                        onClick={() => handleReAnalyze(device)}
                        className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-hp-blue transition-colors flex items-center justify-center gap-2"
                      >
                        <RefreshCcw className="w-3 h-3" /> Re-analyze Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-bold text-hp-dark mb-4 flex items-center gap-2">
                <Info className="w-4 h-4 text-hp-blue" />
                What is Fleet Management?
              </h3>
              <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                <p>
                  The <span className="font-bold text-hp-blue">Fleet Section</span> is a centralized hub designed for users and organizations to oversee multiple HP products simultaneously.
                </p>
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-hp-blue mt-1.5 shrink-0" />
                    <p><span className="font-bold text-hp-dark">Real-time Monitoring:</span> Track the health status and connectivity of all your registered laptops and SitePrint robots.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-hp-blue mt-1.5 shrink-0" />
                    <p><span className="font-bold text-hp-dark">Predictive Maintenance:</span> Our AI analyzes past inspection data to predict when a device needs servicing before a failure occurs.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-hp-blue mt-1.5 shrink-0" />
                    <p><span className="font-bold text-hp-dark">Lifecycle Tracking:</span> Keep records of every inspection and repair in one place to maximize the lifespan of your hardware.</p>
                  </div>
                </div>
                <p className="pt-2 border-t border-slate-100">
                  Ideal for IT departments, construction site managers, and power users who rely on peak performance from their HP hardware ecosystem.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalEstimatedValue = combinedResult?.estimatedResaleValue || 0;
  const totalRepairCosts = combinedResult?.totalRepairCost || 0;

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-[#0050d3] animate-spin" />
          <p className="text-slate-400 font-medium animate-pulse">Loading HP Horus AI...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col font-sans transition-colors duration-300 bg-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 relative overflow-hidden">
        <div className="absolute inset-0 hp-diagonal-bars opacity-5 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3 cursor-pointer" onClick={reset}>
            <img src={HP_LOGO} alt="HP Logo" className="h-8 w-8" referrerPolicy="no-referrer" />
            <span className="text-xl font-bold tracking-tight text-hp-dark">Horus AI</span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <div className="flex items-center gap-2 sm:gap-4">
                {user.role === 'technician' && (
                  <button 
                    onClick={() => { setStep(6); fetchTechnicianStats(); }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full transition-colors font-bold text-sm",
                      step === 6 ? "bg-hp-dark text-white" : "hover:bg-slate-100 text-slate-600"
                    )}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span className="hidden sm:inline">Technician</span>
                  </button>
                )}
                <button 
                  onClick={() => setStep(5)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full transition-colors font-bold text-sm",
                    step === 5 ? "bg-hp-blue text-white" : "hover:bg-slate-100 text-slate-600"
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">Fleet</span>
                </button>
                <button 
                  onClick={() => setStep(4)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full transition-colors",
                    step === 4 ? "bg-slate-100" : "hover:bg-slate-100"
                  )}
                >
                  <User className="w-5 h-5 text-hp-blue" />
                  <span className="font-medium text-sm hidden sm:block">{user.name}</span>
                </button>
                <button onClick={logout} className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                className="px-6 py-2 bg-hp-blue text-white rounded-full text-sm font-bold hover:bg-hp-blue/90 transition-all shadow-lg shadow-hp-blue/20"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        <AnimatePresence mode="wait">
          {step === 6 && (
            <motion.div
              key="technician"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="max-w-7xl mx-auto px-6 sm:px-8 py-12"
            >
              {TechnicianDashboard()}
            </motion.div>
          )}
          {step === 0 && (
            <motion.div
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative overflow-hidden min-h-[calc(100vh-64px)] flex items-center"
            >
              <div className="max-w-7xl mx-auto px-6 sm:px-8 py-12 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full">
                <div className="space-y-8 text-center lg:text-left">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <span className="px-4 py-1.5 bg-hp-blue/10 text-hp-blue rounded-full text-sm font-bold tracking-wider uppercase">
                      AI-Powered Diagnostics
                    </span>
                    <h1 className="mt-6 text-5xl sm:text-7xl font-bold text-hp-dark tracking-tighter leading-tight">
                      The Future of <br />
                      <span className="text-hp-blue">Laptop Care</span>
                    </h1>
                    <p className="mt-6 text-xl text-slate-500 max-w-xl mx-auto lg:mx-0">
                      Professional-grade external inspection for your HP device. 
                      Detect damage, screen defects, and keyboard issues in seconds.
                    </p>
                  </motion.div>

                  <motion.div 
                    className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <button 
                      onClick={() => setStep(1)}
                      className="px-10 py-4 bg-hp-blue text-white rounded-full font-bold text-lg shadow-xl shadow-hp-blue/30 hover:scale-105 transition-all flex items-center gap-2"
                    >
                      Start Inspection
                      <ArrowRight className="w-5 h-5" />
                    </button>
                    {!user && (
                      <button 
                        onClick={() => { setAuthMode('signup'); setShowAuthModal(true); }}
                        className="px-10 py-4 bg-white text-hp-dark border-2 border-slate-200 rounded-full font-bold text-lg hover:bg-slate-50 transition-all"
                      >
                        Create Account
                      </button>
                    )}
                  </motion.div>
                </div>

                <motion.div
                  className="relative"
                  initial={{ opacity: 0, scale: 0.8, rotateY: -20 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1, 
                    rotateY: [0, 10, 0, -10, 0] 
                  }}
                  transition={{ 
                    opacity: { duration: 1 },
                    scale: { duration: 1 },
                    rotateY: { 
                      duration: 10, 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    }
                  }}
                  style={{ perspective: "1200px", transformStyle: "preserve-3d" }}
                >
                  <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl shadow-hp-blue/20 border border-white/20 bg-white glass-card">
                    <img 
                      src={LAPTOP_HERO} 
                      alt="HP Laptop" 
                      className="w-full h-64 sm:h-96 object-contain p-8"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-hp-dark/5 to-transparent" />
                  </div>
                  {/* Decorative Elements */}
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-hp-blue/20 rounded-full blur-3xl animate-pulse" />
                  <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-400/20 rounded-full blur-3xl animate-pulse delay-700" />
                </motion.div>
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto px-6 sm:px-8 py-12 space-y-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-bold text-hp-dark">Select Inspection Type</h2>
                <p className="text-slate-500">Choose the hardware you want to diagnose today.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Laptop Option */}
                <button 
                  onClick={() => setInspectionMode('laptop')}
                  className={cn(
                    "p-8 rounded-3xl border-2 transition-all text-left group relative overflow-hidden",
                    inspectionMode === 'laptop' ? "border-hp-blue bg-hp-blue/5 ring-4 ring-hp-blue/10" : "border-slate-200 bg-white hover:border-hp-blue/30"
                  )}
                >
                  <div className="relative z-10 space-y-4">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
                      inspectionMode === 'laptop' ? "bg-hp-blue text-white" : "bg-slate-100 text-slate-400 group-hover:bg-hp-blue/10 group-hover:text-hp-blue"
                    )}>
                      <Laptop className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-hp-dark">HP Laptop Refurbishment</h3>
                      <p className="text-sm text-slate-500">External health, repair costs, and resale valuation.</p>
                    </div>
                  </div>
                  <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Laptop className="w-32 h-32" />
                  </div>
                </button>

                {/* SitePrint Option */}
                <button 
                  onClick={() => setInspectionMode('siteprint')}
                  className={cn(
                    "p-8 rounded-3xl border-2 transition-all text-left group relative overflow-hidden",
                    inspectionMode === 'siteprint' ? "border-hp-blue bg-hp-blue/5 ring-4 ring-hp-blue/10" : "border-slate-200 bg-white hover:border-hp-blue/30"
                  )}
                >
                  <div className="relative z-10 space-y-4">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
                      inspectionMode === 'siteprint' ? "bg-hp-blue text-white" : "bg-slate-100 text-slate-400 group-hover:bg-hp-blue/10 group-hover:text-hp-blue"
                    )}>
                      <RefreshCcw className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-hp-dark">HP SitePrint Components</h3>
                      <p className="text-sm text-slate-500">Analyze the external inkjet part for wear and maintenance.</p>
                    </div>
                  </div>
                  <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <RefreshCcw className="w-32 h-32" />
                  </div>
                </button>
              </div>

              {inspectionMode === 'laptop' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="text-xl font-bold text-hp-dark text-center">Select Model</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {HP_MODELS.map((model) => (
                      <button
                        key={model}
                        onClick={() => { setSelectedModel(model); setStep(2); }}
                        className={cn(
                          "group p-6 text-left rounded-2xl border-2 transition-all duration-300 hover:shadow-lg",
                          selectedModel === model ? "border-hp-blue bg-hp-blue/5" : "border-slate-200 bg-white hover:border-hp-blue/50"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-slate-100 group-hover:bg-hp-blue/10 transition-colors">
                              <Laptop className="w-6 h-6 text-slate-600 group-hover:text-hp-blue" />
                            </div>
                            <span className="font-semibold text-lg">{model}</span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-hp-blue" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center gap-8 animate-in fade-in slide-in-from-bottom-4 border border-white/5 shadow-2xl">
                  <div className="w-full md:w-1/2 aspect-video rounded-2xl overflow-hidden border border-white/10">
                    <img src={SITEPRINT_HERO} alt="HP SitePrint" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="w-full md:w-1/2 space-y-4">
                    <div className="px-3 py-1 bg-hp-blue/20 text-hp-blue rounded-full text-xs font-bold w-fit uppercase tracking-widest">HP SitePrint Robot</div>
                    <h3 className="text-2xl font-bold">Autonomous Layout Robot</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      HP SitePrint is designed to automate construction layout with high precision. 
                      Regular inkjet inspection ensures the robot maintains its printing quality and longevity in harsh environments.
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-emerald-500" /> External Inkjet</div>
                      <div className="flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Rugged Design</div>
                    </div>
                    <button
                      onClick={() => setStep(2)}
                      className="mt-4 px-8 py-3 bg-hp-blue text-white rounded-full font-bold text-sm shadow-lg shadow-hp-blue/30 hover:bg-hp-blue/90 transition-all flex items-center gap-2 w-fit"
                    >
                      Start Inkjet Inspection
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto px-6 sm:px-8 py-12 space-y-8"
            >
              <div className="flex items-center justify-between">
                <button onClick={() => setStep(1)} className="flex items-center gap-2 text-slate-500 hover:text-hp-dark">
                  <RefreshCcw className="w-4 h-4" /> Change Model
                </button>
                <div className="px-3 py-1 bg-hp-blue/10 text-hp-blue rounded-full text-sm font-bold">
                  {inspectionMode === 'laptop' ? selectedModel : 'HP SitePrint Inkjet'}
                </div>
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-hp-dark">
                  {inspectionMode === 'laptop' ? 'Capture or Upload Photos' : 'Inspect SitePrint Inkjet'}
                </h2>
                <p className="text-slate-500">
                  {inspectionMode === 'laptop' 
                    ? 'Take clear photos of the shell, screen, and keyboard.' 
                    : 'Take close-up photos of the external inkjet part.'}
                </p>
              </div>

              <div {...getRootProps()} className={cn(
                "border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer",
                isDragActive ? "border-hp-blue bg-hp-blue/5" : "border-slate-200 bg-white hover:border-hp-blue/30"
              )}>
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-hp-blue/10 rounded-full flex items-center justify-center">
                    <Camera className="w-8 h-8 text-hp-blue" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Drop images here or click to upload</p>
                    <p className="text-sm text-slate-400">Supports JPG, PNG (Max 10MB)</p>
                  </div>
                </div>
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 group">
                      <img src={img.preview} alt="Preview" className="w-full h-full object-cover" />
                      <button onClick={() => removeImage(idx)} className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-center">
                <button
                  disabled={images.length === 0}
                  onClick={handleAnalyze}
                  className="px-10 py-4 bg-hp-blue text-white rounded-full font-bold text-lg shadow-xl shadow-hp-blue/30 hover:bg-hp-blue/90 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  Start AI Analysis
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-7xl mx-auto px-6 sm:px-8 py-12 space-y-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-hp-dark">Analysis Results</h2>
                <button onClick={reset} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-full font-bold hover:bg-slate-200 transition-colors">
                  New Inspection
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Images & Detailed Analysis */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Images Grid */}
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm overflow-hidden">
                    <div className={cn(
                      "grid gap-4",
                      images.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
                    )}>
                      {images.map((img, idx) => (
                        <div key={idx} className="relative rounded-2xl overflow-hidden bg-slate-100 aspect-video group">
                          <img src={img.preview} alt="Inspection" className="w-full h-full object-cover" />
                          {img.loading && <ScanningOverlay active={true} />}
                          
                          {/* Hotspots - only if we have a combined result and it's not loading */}
                          {!img.loading && combinedResult?.errors?.filter((e: any) => e.imageIndex === idx).map((error: any, eIdx: number) => (
                            <Hotspot 
                              key={eIdx} 
                              x={error.coordinates.x} 
                              y={error.coordinates.y} 
                              width={error.coordinates.width}
                              height={error.coordinates.height}
                              title={error.type} 
                              description={error.description} 
                            />
                          ))}

                          <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded-lg text-[10px] font-bold text-white uppercase tracking-widest">
                            View {idx + 1}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-6 gap-4">
                      <div className="flex items-center gap-4">
                        {isAnalyzing ? (
                          <div className="flex items-center gap-2 text-hp-blue">
                            <RefreshCcw className="w-5 h-5 animate-spin" />
                            <span className="font-bold">AI Analyzing Fleet...</span>
                          </div>
                        ) : combinedError ? (
                          <div className="flex items-center gap-2 text-red-500">
                            <AlertCircle className="w-5 h-5" />
                            <span className="font-bold">Analysis Failed</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-emerald-500">
                            <ShieldCheck className="w-5 h-5" />
                            <span className="font-bold">Fleet Analysis Complete</span>
                          </div>
                        )}
                      </div>
                      
                      {!isAnalyzing && !combinedError && (combinedResult || combinedSitePrintResult) && (
                        <span className={cn(
                          "px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider",
                          (combinedResult?.overallHealth || combinedSitePrintResult?.condition) === "Excellent" ? "bg-emerald-100 text-emerald-700" :
                          (combinedResult?.overallHealth || combinedSitePrintResult?.condition) === "Good" ? "bg-blue-100 text-blue-700" :
                          (combinedResult?.overallHealth || combinedSitePrintResult?.condition) === "Fair" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                        )}>
                          Overall Condition: {combinedResult?.overallHealth || combinedSitePrintResult?.condition}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Combined Analysis Result Details */}
                  {!isAnalyzing && (
                    <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-8">
                      {combinedError ? (
                        <div className="p-8 bg-red-50 border border-red-200 rounded-2xl space-y-4 text-center">
                          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                          <h3 className="text-xl font-bold text-red-700">Verification Error</h3>
                          <p className="text-red-600 max-w-md mx-auto">{combinedError}</p>
                          <button onClick={() => setStep(2)} className="mt-4 px-8 py-3 bg-red-600 text-white rounded-full font-bold">Try Again</button>
                        </div>
                      ) : (
                        <>
                          {combinedResult && (
                            <div className="space-y-8">
                              <div className="space-y-3">
                                <h4 className="font-semibold text-slate-900 flex items-center gap-2 text-lg"><Info className="w-5 h-5 text-hp-blue" /> Fleet Analysis Summary</h4>
                                <p className="text-slate-600 leading-relaxed break-words">{combinedResult.summary}</p>
                              </div>

                              <div className="space-y-4">
                                <h4 className="font-semibold text-slate-900 text-lg">Detected Issues ({combinedResult.errors.length})</h4>
                                {combinedResult.errors.length > 0 ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {combinedResult.errors.map((error, eIdx) => (
                                      <div key={eIdx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                          <div className="w-2 h-2 rounded-full bg-red-500 mt-2 shrink-0" />
                                          <div>
                                            <p className="font-bold text-sm text-hp-dark">{error.type}</p>
                                            <p className="text-xs text-slate-500 break-words">{error.description}</p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-sm font-bold text-hp-blue">{formatPrice(error.repairCost)}</p>
                                          <p className="text-[10px] text-slate-400 uppercase font-bold">Repair</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                    <p className="font-medium text-emerald-700">No external defects detected across all views.</p>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-6 pt-6 border-t border-slate-100">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  <div className="p-4 bg-slate-900 rounded-2xl text-white">
                                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">Total Repair Cost</p>
                                    <p className="text-2xl font-bold">{formatPrice(combinedResult.totalRepairCost)}</p>
                                  </div>
                                  <div className="p-4 bg-hp-blue rounded-2xl text-white">
                                    <p className="text-[10px] uppercase font-bold tracking-wider text-blue-100 mb-1">Est. Resale Value</p>
                                    <p className="text-2xl font-bold">{formatPrice(combinedResult.estimatedResaleValue)}</p>
                                  </div>
                                  <div className="p-4 bg-emerald-100 rounded-2xl text-emerald-700 border border-emerald-200/50">
                                    <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 mb-1">Useful Life Left</p>
                                    <p className="text-2xl font-bold">{combinedResult.estimatedRemainingLifeYears}Y</p>
                                  </div>
                                </div>

                                <div className={cn(
                                  "p-6 rounded-3xl border-2 flex gap-6 items-start",
                                  combinedResult.recommendation.action === "Repair" ? "bg-emerald-50 border-emerald-100" :
                                  combinedResult.recommendation.action === "Sell As-Is" ? "bg-blue-50 border-blue-100" : "bg-red-50 border-red-100"
                                )}>
                                  <div className={cn(
                                    "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0",
                                    combinedResult.recommendation.action === "Repair" ? "bg-emerald-500 text-white" :
                                    combinedResult.recommendation.action === "Sell As-Is" ? "bg-blue-500 text-white" : "bg-red-500 text-white"
                                  )}>
                                    {combinedResult.recommendation.action === "Repair" ? <ShieldCheck className="w-8 h-8" /> : 
                                     combinedResult.recommendation.action === "Sell As-Is" ? <RefreshCcw className="w-8 h-8" /> : <X className="w-8 h-8" />}
                                  </div>
                                  <div>
                                    <p className={cn(
                                      "text-xs font-bold uppercase tracking-widest mb-1",
                                      combinedResult.recommendation.action === "Repair" ? "text-emerald-600" :
                                      combinedResult.recommendation.action === "Sell As-Is" ? "text-blue-600" : "text-red-600"
                                    )}>AI Recommendation: {combinedResult.recommendation.action}</p>
                                    <p className="text-lg font-bold text-hp-dark mb-1">Expert Verdict</p>
                                    <p className="text-slate-700 leading-relaxed break-words">{combinedResult.recommendation.reasoning}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                                  <a href="https://support.hp.com/us-en/contact" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors shadow-sm">
                                    <Shield className="w-5 h-5 text-hp-blue" /> Support
                                  </a>
                                  <a href="https://www.hp.com/us-en/shop/cat/laptops" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-hp-blue text-white font-bold hover:bg-hp-blue/90 transition-colors shadow-md">
                                    <ShoppingBag className="w-5 h-5" /> Shop New
                                  </a>
                                  <a href="https://www.hp.com/us-en/shop/slp/hp-trade-in" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors shadow-md">
                                    <DollarSign className="w-5 h-5" /> Trade-In
                                  </a>
                                  <a href="https://www.hp.com/us-en/parts-store/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors shadow-sm">
                                    <Wrench className="w-5 h-5 text-hp-blue" /> Parts Store
                                  </a>
                                </div>
                              </div>
                            </div>
                          )}

                          {combinedSitePrintResult && (
                            <div className="space-y-8">
                              <div className="space-y-3">
                                <h4 className="font-semibold text-slate-900 flex items-center gap-2 text-lg"><Info className="w-5 h-5 text-hp-blue" /> {combinedSitePrintResult.componentType} Fleet Analysis</h4>
                                <p className="text-slate-600 leading-relaxed break-words">{combinedSitePrintResult.summary}</p>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="p-6 bg-slate-100 rounded-3xl">
                                  <p className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-2">
                                    {combinedSitePrintResult.componentType === 'Inkjet' ? 'Clog/Wear Level' : 'Wear Level'}
                                  </p>
                                  <div className="flex items-center gap-4">
                                    <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                                      <div className="h-full bg-hp-blue" style={{ width: `${combinedSitePrintResult.wearLevel}%` }} />
                                    </div>
                                    <span className="text-lg font-bold">{combinedSitePrintResult.wearLevel}%</span>
                                  </div>
                                </div>
                                <div className="p-6 bg-slate-900 rounded-3xl text-white">
                                  <p className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-2">Useful Life Left</p>
                                  <p className="text-3xl font-bold">{combinedSitePrintResult.estimatedRemainingLifeYears} Years</p>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <h4 className="font-semibold text-slate-900 text-lg">Maintenance Issues ({combinedSitePrintResult.detectedIssues.length})</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {combinedSitePrintResult.detectedIssues.map((issue, iIdx) => (
                                    <div key={iIdx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                                      <div className="flex items-center gap-4">
                                        <div className={cn(
                                          "w-3 h-3 rounded-full",
                                          issue.severity === "High" ? "bg-red-500" : issue.severity === "Medium" ? "bg-amber-500" : "bg-emerald-500"
                                        )} />
                                        <div>
                                          <p className="font-bold text-hp-dark">{issue.type}</p>
                                          <p className="text-xs text-slate-500 break-words">{issue.description}</p>
                                        </div>
                                      </div>
                                      <span className={cn(
                                        "text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest",
                                        issue.severity === "High" ? "bg-red-100 text-red-700" : 
                                        issue.severity === "Medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                      )}>{issue.severity}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className={cn(
                                "p-6 rounded-3xl border-2 flex gap-6 items-start",
                                combinedSitePrintResult.repairNeeded ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100"
                              )}>
                                <div className={cn(
                                  "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0",
                                  combinedSitePrintResult.repairNeeded ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"
                                )}>
                                  {combinedSitePrintResult.repairNeeded ? <RefreshCcw className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
                                </div>
                                <div>
                                  <p className={cn(
                                    "text-xs font-bold uppercase tracking-widest mb-1",
                                    combinedSitePrintResult.repairNeeded ? "text-amber-600" : "text-emerald-600"
                                  )}>Maintenance Verdict: {combinedSitePrintResult.repairNeeded ? "Repair Required" : "Healthy"}</p>
                                  <p className="text-lg font-bold text-hp-dark mb-1">System Health Report</p>
                                  <p className="text-slate-700 leading-relaxed">
                                    {combinedSitePrintResult.repairNeeded 
                                      ? `Maintenance is recommended ${combinedSitePrintResult.repairTimeline}. System devaluation is currently at ${combinedSitePrintResult.devaluationPercentage}%.` 
                                      : `The inkjet part is in optimal condition. No immediate repairs needed. Devaluation is minimal at ${combinedSitePrintResult.devaluationPercentage}%.`}
                                  </p>
                                </div>
                              </div>

                              {combinedSitePrintResult.manualRepairRecommendations && combinedSitePrintResult.manualRepairRecommendations.length > 0 && (
                                <div className="bg-blue-50 border border-blue-100 p-8 rounded-3xl space-y-6">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-hp-blue flex items-center justify-center text-white">
                                      <Wrench className="w-5 h-5" />
                                    </div>
                                    <h4 className="text-xl font-bold text-hp-dark">Manual Repair Recommendations</h4>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {combinedSitePrintResult.manualRepairRecommendations.map((rec, rIdx) => (
                                      <div key={rIdx} className="bg-white p-4 rounded-2xl border border-blue-100 flex items-start gap-3 shadow-sm">
                                        <div className="w-6 h-6 rounded-full bg-blue-100 text-hp-blue flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                          {rIdx + 1}
                                        </div>
                                        <p className="text-slate-700 text-sm leading-relaxed font-medium">{rec}</p>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="p-4 bg-white/50 rounded-2xl border border-blue-100/50 flex items-center gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                                    <p className="text-[11px] text-slate-500 italic">
                                      Note: Manual cleaning should be performed with caution using approved solvents (like 70% Isopropyl Alcohol) and lint-free materials to avoid damaging the delicate nozzle plate.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Column - Summary & Recommendations */}
                <div className="space-y-8">
                  <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
                    <h3 className="text-xl font-bold text-hp-dark">Analysis Summary</h3>
                    <div className="space-y-4">
                      {inspectionMode === 'laptop' && (
                        <>
                          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                            <span className="text-slate-500 font-medium">Total Estimated Value</span>
                            <span className="text-2xl font-bold text-hp-blue">{formatPrice(totalEstimatedValue)}</span>
                          </div>
                          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                            <span className="text-slate-500 font-medium">Total Repair Costs</span>
                            <span className="text-2xl font-bold text-red-500">{formatPrice(totalRepairCosts)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="space-y-4 pt-4">
                      <h4 className="font-bold text-hp-dark flex items-center gap-2">
                        <Zap className="w-4 h-4 text-hp-blue" />
                        AI Recommendations
                      </h4>
                      <div className="space-y-3">
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-3">
                          <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-emerald-700">Schedule Repairs</p>
                            <p className="text-xs text-emerald-600">Fixing detected issues can restore up to 95% of original value.</p>
                          </div>
                        </div>
                        <div className="p-4 bg-hp-blue/5 border border-hp-blue/10 rounded-2xl flex gap-3">
                          <RefreshCcw className="w-5 h-5 text-hp-blue shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-hp-blue">HP Trade-In Program</p>
                            <p className="text-xs text-hp-blue/70">Get immediate credit towards a new HP device based on this analysis.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={downloadReport}
                      className="w-full py-4 bg-hp-dark text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                    >
                      <Download className="w-5 h-5" />
                      Download Full Report
                    </button>

                    {showFeedbackForm && !feedbackSubmitted && (
                      <div className="pt-6 border-t border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-4">
                        <h4 className="font-bold text-hp-dark text-sm">Was this analysis accurate?</h4>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => submitFeedback(true)}
                            className="flex-1 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-sm hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Yes
                          </button>
                          <button 
                            onClick={() => submitFeedback(false)}
                            className="flex-1 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                          >
                            <XCircle className="w-4 h-4" /> No
                          </button>
                        </div>
                        <textarea 
                          placeholder="Optional: Tell us what we missed..."
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-hp-blue outline-none resize-none h-20"
                        />
                      </div>
                    )}

                    {feedbackSubmitted && (
                      <div className="pt-6 border-t border-slate-100 flex items-center gap-3 text-emerald-600 animate-in fade-in zoom-in-95">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">Thank you for your feedback!</p>
                          <p className="text-xs opacity-80">We'll use this to improve future inspections.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-hp-blue" />
                      <h3 className="font-bold text-hp-dark">Chat with AI Expert</h3>
                    </div>
                    <div className="h-64 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                      {chatMessages.map((msg, idx) => (
                        <div key={idx} className={cn(
                          "p-3 rounded-2xl text-xs leading-relaxed",
                          msg.role === 'ai' ? "bg-slate-100 text-slate-700 mr-8" : "bg-hp-blue text-white ml-8"
                        )}>
                          {msg.content}
                        </div>
                      ))}
                      {isChatLoading && (
                        <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          AI is thinking...
                        </div>
                      )}
                    </div>
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <input 
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask about these results..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-xs focus:ring-2 focus:ring-hp-blue outline-none"
                      />
                      <button type="submit" className="p-2 bg-hp-blue text-white rounded-full hover:bg-hp-blue/90 transition-colors">
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && user && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-6xl mx-auto px-6 sm:px-8 py-12 space-y-12"
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-hp-blue rounded-full flex items-center justify-center text-white text-3xl font-bold">
                    {user.name[0]}
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-hp-dark">{user.name}</h2>
                    <p className="text-slate-500">{user.email}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={reset} className="px-6 py-2 bg-hp-blue text-white rounded-full font-bold shadow-lg shadow-hp-blue/20">New Inspection</button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Past Inspections */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <History className="w-5 h-5 text-hp-blue" />
                      Inspection History
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {pastInspections.length > 0 ? pastInspections.map((record) => (
                      <div 
                        key={record.id} 
                        onClick={() => setSelectedInspection(record)}
                        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="font-bold text-lg group-hover:text-hp-blue transition-colors">{record.model}</p>
                            <p className="text-sm text-slate-400">{new Date(record.date).toLocaleDateString()}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-bold uppercase",
                              record.overall_health === "Excellent" ? "bg-emerald-100 text-emerald-700" :
                              record.overall_health === "Good" ? "bg-blue-100 text-blue-700" :
                              record.overall_health === "Fair" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                            )}>
                              {record.overall_health}
                            </span>
                            {record.results.estimatedResaleValue && (
                              <span className="text-xs font-bold text-hp-blue">
                                Valued at {formatPrice(record.results.estimatedResaleValue)}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2 mb-4">{record.summary}</p>
                        {record.results.recommendation && (
                          <div className="pt-4 border-t border-slate-50 flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase text-slate-400">Recommendation:</span>
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-md",
                              record.results.recommendation.action === "Repair" ? "bg-emerald-50 text-emerald-600" :
                              record.results.recommendation.action === "Sell As-Is" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"
                            )}>
                              {record.results.recommendation.action}
                            </span>
                          </div>
                        )}
                      </div>
                    )) : (
                      <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                        <p className="text-slate-400">No inspections found. Start your first one!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 5 && user && (
            <motion.div
              key="fleet"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="max-w-7xl mx-auto px-6 sm:px-8 py-12"
            >
              {FleetDashboard()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-hp-dark/60 backdrop-blur-sm"
              onClick={() => setShowAuthModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="text-center space-y-2">
                  <img src={HP_LOGO} alt="HP" className="h-10 w-10 mx-auto" referrerPolicy="no-referrer" />
                  <h3 className="text-2xl font-bold">
                    {authMode === 'login' ? 'Welcome Back' : authMode === 'signup' ? 'Join HP Horus AI' : 'Reset Password'}
                  </h3>
                  <p className="text-slate-500 text-sm">
                    {authMode === 'login' ? 'Access personalized diagnostics and history.' : 
                     authMode === 'signup' ? 'Join the HP Large Format support team.' : 
                     'Enter your email to receive a reset link.'}
                  </p>
                </div>

                {resetSent ? (
                  <div className="text-center space-y-6">
                    <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
                      Password reset link sent! Please check your inbox.
                    </div>
                    <button 
                      onClick={() => { setResetSent(false); setAuthMode('login'); }}
                      className="text-hp-blue font-bold hover:underline"
                    >
                      Back to Login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleAuth} className="space-y-4">
                    {authMode === 'signup' && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                          <input 
                            required type="text" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-hp-blue outline-none transition-all"
                            value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Country</label>
                          <select 
                            required
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-hp-blue outline-none transition-all"
                            value={authForm.country} onChange={e => setAuthForm({...authForm, country: e.target.value})}
                          >
                            {["United States", "United Kingdom", "Canada", "Australia", "Germany", "France", "Spain", "Italy", "Japan", "China", "India", "Brazil", "Mexico", "Norway", "Sweden", "Finland", "Iceland"].map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                      <input 
                        required type="email" 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-hp-blue outline-none transition-all"
                        value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})}
                      />
                    </div>
                    
                    {authMode !== 'forgot' && (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                          {authMode === 'login' && (
                            <button 
                              type="button"
                              onClick={() => setAuthMode('forgot')}
                              className="text-xs text-hp-blue font-bold hover:underline"
                            >
                              Forgot?
                            </button>
                          )}
                        </div>
                        <input 
                          required type="password" 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-hp-blue outline-none transition-all"
                          value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})}
                        />
                      </div>
                    )}

                    {authError && <p className="text-sm text-red-500 font-medium">{authError}</p>}

                    <button 
                      disabled={authLoading}
                      className="w-full py-4 bg-hp-blue text-white rounded-xl font-bold shadow-lg shadow-hp-blue/20 hover:bg-hp-blue/90 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {authLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        authMode === 'login' ? 'Sign In' : authMode === 'signup' ? 'Create Account' : 'Send Reset Link'
                      )}
                    </button>
                  </form>
                )}

                {!resetSent && (
                  <div className="text-center">
                    <button 
                      onClick={() => {
                        setAuthMode(authMode === 'login' ? 'signup' : 'login');
                        setAuthError('');
                      }}
                      className="text-sm font-bold text-hp-blue hover:underline"
                    >
                      {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inspection Detail Modal */}
      <AnimatePresence>
        {selectedInspection && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedInspection(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-xl font-bold text-hp-dark">{selectedInspection.model}</h3>
                  <p className="text-sm text-slate-500">{new Date(selectedInspection.date).toLocaleString()}</p>
                </div>
                <button 
                  onClick={() => setSelectedInspection(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8">
                <div className="flex items-center justify-between p-4 bg-hp-blue/5 rounded-2xl border border-hp-blue/10">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-hp-blue" />
                    <span className="font-bold text-hp-dark">Overall Health</span>
                  </div>
                  <span className={cn(
                    "px-4 py-1 rounded-full text-sm font-bold uppercase",
                    selectedInspection.overall_health === "Excellent" ? "bg-emerald-100 text-emerald-700" :
                    selectedInspection.overall_health === "Good" ? "bg-blue-100 text-blue-700" :
                    selectedInspection.overall_health === "Fair" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                  )}>
                    {selectedInspection.overall_health}
                  </span>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-hp-dark flex items-center gap-2">
                    <Info className="w-4 h-4 text-hp-blue" />
                    Inspection Summary
                  </h4>
                  <p className="text-slate-600 leading-relaxed break-words">
                    {selectedInspection.summary}
                  </p>
                </div>

                {selectedInspection.results.recommendation && (
                  <div className={cn(
                    "p-6 rounded-2xl border-2 space-y-3",
                    selectedInspection.results.recommendation.action === "Repair" ? "bg-emerald-50 border-emerald-100" :
                    selectedInspection.results.recommendation.action === "Sell As-Is" ? "bg-blue-50 border-blue-100" : "bg-red-50 border-red-100"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        selectedInspection.results.recommendation.action === "Repair" ? "bg-emerald-500 text-white" :
                        selectedInspection.results.recommendation.action === "Sell As-Is" ? "bg-blue-500 text-white" : "bg-red-500 text-white"
                      )}>
                        {selectedInspection.results.recommendation.action === "Repair" ? <ShieldCheck className="w-5 h-5" /> : 
                         selectedInspection.results.recommendation.action === "Sell As-Is" ? <RefreshCcw className="w-5 h-5" /> : <X className="w-5 h-5" />}
                      </div>
                      <span className={cn(
                        "font-bold uppercase tracking-wider text-sm",
                        selectedInspection.results.recommendation.action === "Repair" ? "text-emerald-700" :
                        selectedInspection.results.recommendation.action === "Sell As-Is" ? "text-blue-700" : "text-red-700"
                      )}>
                        Recommendation: {selectedInspection.results.recommendation.action}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed break-words">
                      {selectedInspection.results.recommendation.reasoning}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Estimated Value</p>
                    <p className="text-2xl font-bold text-hp-blue">{formatPrice(selectedInspection.results.estimatedResaleValue || 0)}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Repair Cost</p>
                    <p className="text-2xl font-bold text-red-500">{formatPrice(selectedInspection.results.totalRepairCost || 0)}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setSelectedInspection(null)}
                  className="w-full py-3 bg-hp-dark text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
                >
                  Close Report
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddDeviceModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddDeviceModal(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-hp-blue/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-hp-blue flex items-center justify-center text-white">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-hp-dark">Register New Device</h3>
                </div>
                <button 
                  onClick={() => setShowAddDeviceModal(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRegisterDevice} className="p-8 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Device Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewDevice({...newDevice, type: 'laptop'})}
                      className={cn(
                        "py-3 rounded-xl border-2 font-bold text-sm transition-all flex items-center justify-center gap-2",
                        newDevice.type === 'laptop' ? "border-hp-blue bg-hp-blue/5 text-hp-blue" : "border-slate-100 text-slate-400"
                      )}
                    >
                      <Laptop className="w-4 h-4" /> Laptop
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewDevice({...newDevice, type: 'siteprint'})}
                      className={cn(
                        "py-3 rounded-xl border-2 font-bold text-sm transition-all flex items-center justify-center gap-2",
                        newDevice.type === 'siteprint' ? "border-hp-blue bg-hp-blue/5 text-hp-blue" : "border-slate-100 text-slate-400"
                      )}
                    >
                      <RefreshCcw className="w-4 h-4" /> SitePrint
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Model Name</label>
                  <input 
                    required
                    type="text"
                    placeholder="e.g. HP EliteBook 840 G10"
                    value={newDevice.model}
                    onChange={(e) => setNewDevice({...newDevice, model: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-hp-blue outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Serial Number (Optional)</label>
                  <input 
                    type="text"
                    placeholder="e.g. 5CD1234567"
                    value={newDevice.serialNumber}
                    onChange={(e) => setNewDevice({...newDevice, serialNumber: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-hp-blue outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Purchase Date (Optional)</label>
                  <input 
                    type="date"
                    value={newDevice.purchaseDate}
                    onChange={(e) => setNewDevice({...newDevice, purchaseDate: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-hp-blue outline-none transition-all"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-hp-blue text-white rounded-2xl font-bold hover:bg-hp-blue/90 transition-colors shadow-lg shadow-hp-blue/20 mt-4"
                >
                  Register Device
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {footerSection && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFooterSection(null)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-hp-blue/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-hp-blue flex items-center justify-center text-white">
                    {footerSection === 'privacy' ? <Shield className="w-5 h-5" /> : 
                     footerSection === 'terms' ? <FileText className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                  </div>
                  <h3 className="text-xl font-bold text-hp-dark capitalize">{footerSection}</h3>
                </div>
                <button 
                  onClick={() => setFooterSection(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                {footerSection === 'privacy' && (
                  <div className="space-y-4">
                    <p className="text-slate-600 leading-relaxed">
                      At Horus AI, we take your privacy seriously. Our diagnostic tools are designed with data protection at their core.
                    </p>
                    <ul className="space-y-3">
                      {[
                        "Data Collection: We collect diagnostic data and images to improve HP product quality.",
                        "Usage: Your data is used for hardware analysis and refurbishment estimates.",
                        "Security: We implement industry-standard security measures to protect your information."
                      ].map((item, i) => (
                        <li key={i} className="flex gap-3 text-sm text-slate-600">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {footerSection === 'terms' && (
                  <div className="space-y-4">
                    <p className="text-slate-600 leading-relaxed">
                      By using the Horus AI Diagnostic System, you agree to the following terms and conditions.
                    </p>
                    <ul className="space-y-3">
                      {[
                        "Use of Service: Horus AI is for diagnostic purposes only.",
                        "Accuracy: AI results are estimates and should be verified by a certified technician.",
                        "Liability: HP is not liable for decisions made based on AI diagnostic results."
                      ].map((item, i) => (
                        <li key={i} className="flex gap-3 text-sm text-slate-600">
                          <CheckCircle2 className="w-5 h-5 text-hp-blue shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {footerSection === 'support' && (
                  <div className="space-y-6">
                    <div className="p-6 bg-hp-blue/5 rounded-2xl border border-hp-blue/10 text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-hp-blue/10 flex items-center justify-center mx-auto">
                        <Mail className="w-8 h-8 text-hp-blue" />
                      </div>
                      <div>
                        <h4 className="font-bold text-hp-dark">Contact Support</h4>
                        <p className="text-sm text-slate-500">Our team is here to help you.</p>
                      </div>
                      <a 
                        href="mailto:horusai@hp.com?subject=Horus AI Support Request&body=Hello Horus AI Team,%0D%0A%0D%0AI need assistance with..." 
                        className="block w-full py-3 bg-hp-blue text-white rounded-xl font-bold hover:bg-hp-blue/90 transition-colors"
                      >
                        horusai@hp.com
                      </a>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Support Hours</p>
                      <p className="text-sm text-slate-600">Monday - Friday, 9 AM - 5 PM EST</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setFooterSection(null)}
                  className="w-full py-3 bg-hp-dark text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="bg-slate-900 text-white py-16 relative overflow-hidden hp-diagonal-bars">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 text-center space-y-8 relative z-10">
          <img src={HP_LOGO} alt="HP Logo" className="h-10 w-10 mx-auto" referrerPolicy="no-referrer" />
          <div className="flex justify-center gap-12 text-sm font-bold text-slate-400 uppercase tracking-widest">
            <button onClick={() => setFooterSection('privacy')} className="hover:text-white transition-colors">Privacy</button>
            <button onClick={() => setFooterSection('terms')} className="hover:text-white transition-colors">Terms</button>
            <button onClick={() => setFooterSection('support')} className="hover:text-white transition-colors">Support</button>
          </div>
          <div className="h-px w-24 bg-white/10 mx-auto" />
          <div className="space-y-2">
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              © {new Date().getFullYear()} HP Development Company, L.P.
            </p>
          </div>
        </div>
      </footer>
    </div>
    </ErrorBoundary>
  );
}
