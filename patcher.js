const script = document.createElement('script')
script.textContent = `(function(){
  const orig = history.pushState.bind(history)
  history.pushState = function(...args) {
    orig(...args)
    document.dispatchEvent(new CustomEvent('mc:urlchange'))
  }
  const origReplace = history.replaceState.bind(history)
  history.replaceState = function(...args) {
    origReplace(...args)
    document.dispatchEvent(new CustomEvent('mc:urlchange'))
  }
})()`
document.documentElement.appendChild(script)
script.remove()
