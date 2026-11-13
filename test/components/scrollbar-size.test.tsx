/**
 * The size of the scroll bars is measured with an element added to the page. A page that is not
 * displayed yet gives it no box: measured at that moment (when the module is imported, as it was),
 * the bars count for nothing and the table is laid out under them.
 */
describe("size of the scroll bars of the browser", () => {
  let isDisplayed = false;
  const isProbe = (element: HTMLElement) => element.style.overflow === "scroll" && element.style.left === "-9999px";
  const offsetWidth = jest.spyOn(HTMLElement.prototype, "offsetWidth", "get");
  const clientWidth = jest.spyOn(HTMLElement.prototype, "clientWidth", "get");

  beforeEach(() => {
    isDisplayed = false;
    document.body.innerHTML = "";
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    jest.resetModules();
    offsetWidth.mockImplementation(function (this: HTMLElement) {
      return isProbe(this) && isDisplayed ? 1337 : 0;
    });
    clientWidth.mockImplementation(function (this: HTMLElement) {
      return isProbe(this) && isDisplayed ? 1322 : 0;
    });
  });

  afterAll(() => {
    offsetWidth.mockRestore();
    clientWidth.mockRestore();
  });

  it("is not taken from a page that is not displayed, and is measured once it is", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getDefaultScrollbarSize } = require("../../src/components/scroller");
    expect(getDefaultScrollbarSize()).toBe(0);

    isDisplayed = true;
    expect(getDefaultScrollbarSize()).toBe(15);
    // measured once: the element is not added to the page any more
    const appendChild = jest.spyOn(document.body, "appendChild");
    expect(getDefaultScrollbarSize()).toBe(15);
    expect(appendChild).not.toHaveBeenCalled();
    appendChild.mockRestore();
  });

  /** Scroller of 500 x 300 that overflows on both axes, rendered with the modules loaded for the test. */
  function renderScroller(props: { scrollbarSize?: number }, onMounted?: () => void): HTMLElement | null {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const React = require("react");
    const { createRoot } = require("react-dom/client");
    const { act } = require("react-dom/test-utils");
    const Scroller = require("../../src/components/scroller").default;
    /* eslint-enable @typescript-eslint/no-var-requires */
    // its effect runs before the one of the scroller, rendered after it
    const Mounted = () => {
      React.useLayoutEffect(() => onMounted?.());
      return null;
    };
    const scroller = React.createElement(
      Scroller,
      { width: 500, height: 300, virtualWidth: 2000, virtualHeight: 1000, onScroll: jest.fn(), ...props },
      React.createElement("div"),
    );
    const container = document.body.appendChild(document.createElement("div"));
    act(() => createRoot(container).render(React.createElement(React.Fragment, null, React.createElement(Mounted), scroller)));
    return container.querySelector<HTMLElement>(".scroller-content");
  }

  it("a table rendered before the page is displayed gets the room of its scroll bars once it is", () => {
    // displayed between the render and the moment the components are in the document
    const content = renderScroller({}, () => {
      isDisplayed = true;
    });

    expect(content?.style.minWidth).toBe("485px");
    expect(content?.style.minHeight).toBe("285px");
  });

  it("the size given by the application is taken as it is", () => {
    isDisplayed = true;
    expect(renderScroller({ scrollbarSize: 6 })?.style.minWidth).toBe("494px");
  });
});
