import { getElement } from './get-element';

type Section =
  | 'overview'
  | 'transactions'
  | 'creditscore'
  | 'bills'
  | 'budgets'
  | 'goals'
  | 'trends'
  | 'investments'
  | 'marketplace'
  | 'settings';

class SectionChangeEvent extends Event {
  constructor(public readonly section: Section) {
    super('change');
  }
}

class ActiveSection extends EventTarget {
  #activeSection: Section;

  get activeSection() {
    return this.#activeSection;
  }

  set activeSection(section: Section) {
    if (section && this.#activeSection !== section) {
      this.#activeSection = section;
      this.dispatchEvent(new SectionChangeEvent(section));
    }
  }
}
const sectionObserver = new ActiveSection();

/** Run setup and teardown code based on the active top-level menu section in Mint. */
export const whenMintSectionActive = ({
  section,
  onActivated,
  onDeactivated,
}: {
  section: Section;
  onActivated: () => void;
  onDeactivated: () => void;
}) => {
  let isActive = sectionObserver.activeSection === section;
  if (isActive) {
    onActivated();
  }
  sectionObserver.addEventListener('change', (event: SectionChangeEvent) => {
    if (section === event.section) {
      isActive = true;
      onActivated();
    } else if (isActive) {
      isActive = false;
      onDeactivated();
    }
  });
};

// Watch the active menu item
(async () => {
  const nav = await getElement('.smart-money-app-left-nav nav ul');
  const updateActiveSection = () => {
    sectionObserver.activeSection = nav
      .querySelector('li[class*="selected"] a')
      ?.getAttribute('data-auto-sel')
      ?.replace('nav-', '') as Section;
  };
  const observer = new MutationObserver(updateActiveSection);
  observer.observe(nav, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    subtree: true,
  });
  updateActiveSection();
})();
