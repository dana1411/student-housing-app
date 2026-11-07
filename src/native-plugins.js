// Capacitor plugins, loaded only inside the phone app.
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export const fs = { Filesystem, Directory };
export const share = { Share };
export const browser = { Browser };
export const app = { App };
export const splash = { SplashScreen };
export const status = { StatusBar, Style };
