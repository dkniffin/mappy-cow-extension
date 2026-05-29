const ext = typeof browser !== 'undefined' ? browser : chrome
import(ext.runtime.getURL('ui.js'))
