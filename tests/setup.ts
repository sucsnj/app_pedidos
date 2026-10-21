/** O jsdom não implementa `scrollIntoView` — stub para os testes de UI. */
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}
