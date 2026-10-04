// Line icons from Lucide (ISC license, https://lucide.dev), rendered as inline SVG strings so they
// work inside HTML templates and follow the theme through currentColor. Only the icons listed here
// end up in the bundle.
import {
  Activity,
  Archive,
  ArrowDown,
  ArrowUp,
  BatteryCharging,
  Cake,
  Calculator,
  Calendar,
  Camera,
  ChartColumn,
  Check,
  ChevronDown,
  ClipboardList,
  Clock,
  Cloud,
  Download,
  Dumbbell,
  Ellipsis,
  Flame,
  History,
  Info,
  Layers,
  Link,
  ListPlus,
  Lock,
  LogOut,
  Mail,
  Minus,
  Moon,
  NotebookPen,
  Package,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Ruler,
  Salad,
  Save,
  Scale,
  Settings,
  Share2,
  Target,
  Timer,
  Trash2,
  TrendingUp,
  Trophy,
  Upload,
  User,
  Vibrate,
  Volume2,
  Wrench,
  X,
  Zap
} from 'lucide';

const ICONS = {
  activity: Activity,
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  battery: BatteryCharging,
  calculator: Calculator,
  calendar: Calendar,
  chart: ChartColumn,
  check: Check,
  'chevron-down': ChevronDown,
  clipboard: ClipboardList,
  cloud: Cloud,
  download: Download,
  dumbbell: Dumbbell,
  ellipsis: Ellipsis,
  flame: Flame,
  history: History,
  info: Info,
  layers: Layers,
  link: Link,
  'list-plus': ListPlus,
  'log-out': LogOut,
  mail: Mail,
  minus: Minus,
  moon: Moon,
  notes: NotebookPen,
  pencil: Pencil,
  plus: Plus,
  refresh: RefreshCw,
  reset: RotateCcw,
  salad: Salad,
  save: Save,
  scale: Scale,
  settings: Settings,
  share: Share2,
  target: Target,
  timer: Timer,
  trash: Trash2,
  trend: TrendingUp,
  trophy: Trophy,
  upload: Upload,
  user: User,
  wrench: Wrench,
  x: X,
  zap: Zap,
  archive: Archive,
  cake: Cake,
  camera: Camera,
  clock: Clock,
  lock: Lock,
  package: Package,
  palette: Palette,
  ruler: Ruler,
  vibrate: Vibrate,
  volume: Volume2
};

export const ICON_NAMES = Object.keys(ICONS);

export function icon(name, { size = 18, className = '' } = {}) {
  const node = ICONS[name];
  if (!node) {
    console.warn('Unknown icon:', name);
    return '';
  }
  const children = node
    .map(
      ([tag, attrs]) =>
        `<${tag} ${Object.entries(attrs)
          .map(([k, v]) => `${k}="${v}"`)
          .join(' ')}/>`
    )
    .join('');
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${children}</svg>`;
}

// Static markup in index.html uses <i data-icon="name" data-size="16"></i> placeholders.
export function hydrateIcons(root = document) {
  root.querySelectorAll('i[data-icon]').forEach(el => {
    el.outerHTML = icon(el.dataset.icon, { size: Number(el.dataset.size) || 18, className: el.className });
  });
}
