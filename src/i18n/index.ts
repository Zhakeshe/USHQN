import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from './locales/ru.json'
import kk from './locales/kk.json'
import en from './locales/en.json'

const LANG_KEY = 'ushqn_lang'

const savedLang = localStorage.getItem(LANG_KEY) ?? 'ru'

void i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    kk: { translation: kk },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(LANG_KEY, lng)
  document.documentElement.lang = lng
})

export default i18n
