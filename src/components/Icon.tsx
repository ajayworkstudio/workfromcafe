// Ikon dari Phosphor (bukan gaya lucide yang umum dipakai situs lain).
// `duo` dipakai untuk ikon fitur di dalam kotak (penilaian, fasilitas, manfaat).
import {
  House, MagnifyingGlass, MapTrifold, User, WhatsappLogo, WifiHigh, Star, Bell, Bug, Heart, Check,
  MapPin, Clock, Lock, ArrowSquareOut, SquaresFour, Tag, Users, GearSix, Plus, PencilSimple, Trash, Eye,
  EyeSlash, ArrowLeft, Image, BookOpenText, InstagramLogo, Crosshair, Gift, Table, Gauge, SpeakerHigh,
  Armchair, Sparkle, Smiley, Wallet, Car, Moon, ForkKnife, Snowflake, Tree, Cigarette, Desk, PawPrint,
  MusicNotes, PlugCharging, CalendarBlank, ChatCircle, PaperPlaneTilt, Tray, X, CaretRight, Sliders, ArrowRight,
  CaretLeft, Export, Link, FacebookLogo, Question, Coffee, TextAlignLeft, TextAlignCenter, TextAlignRight, ImageSquare, BookmarkSimple,
} from "@phosphor-icons/react/ssr";
import type { Icon as PhIcon } from "@phosphor-icons/react";

const icons: Record<string, PhIcon> = {
  home: House, search: MagnifyingGlass, map: MapTrifold, user: User, whatsapp: WhatsappLogo, wifi: WifiHigh,
  plug: PlugCharging, star: Star, bell: Bell, bug: Bug, heart: Heart, check: Check, pin: MapPin, clock: Clock,
  lock: Lock, external: ArrowSquareOut, grid: SquaresFour, tag: Tag, users: Users, settings: GearSix,
  plus: Plus, edit: PencilSimple, trash: Trash, eye: Eye, eyeOff: EyeSlash, arrowLeft: ArrowLeft,
  image: Image, book: BookOpenText, instagram: InstagramLogo, locate: Crosshair, gift: Gift, table: Table,
  gauge: Gauge, volume: SpeakerHigh, sofa: Armchair, sparkle: Sparkle, smile: Smiley, wallet: Wallet,
  car: Car, moon: Moon, utensils: ForkKnife, snow: Snowflake, tree: Tree, smoke: Cigarette, desk: Desk,
  paw: PawPrint, music: MusicNotes, calendar: CalendarBlank, chat: ChatCircle, send: PaperPlaneTilt,
  inbox: Tray, x: X, chevron: CaretRight, sliders: Sliders, arrow: ArrowRight, back: CaretLeft,
  share: Export, link: Link, facebook: FacebookLogo, help: Question, cup: Coffee,
  alignLeft: TextAlignLeft, alignCenter: TextAlignCenter, alignRight: TextAlignRight, picture: ImageSquare, bookmark: BookmarkSimple,
};

export default function Icon({ name, className = "h-5 w-5", filled = false, duo = false }: { name: string; className?: string; filled?: boolean; duo?: boolean }) {
  const C = icons[name] ?? Question;
  return <C className={className} weight={filled ? "fill" : duo ? "duotone" : "regular"} aria-hidden />;
}
