// VillainGuide (CA-049, Wave 4).
//
// This is the player's ONLY in-app reference for every game concept, and it had
// two tests — both about the Escape key. All five tabs (lines 112-218) were
// uncovered.
//
// The content contracts at the bottom are the point. `VILLAINS` is assembled
// from a hand-written order list and a hand-written description map, filtered
// against the labels the dealer actually uses. A villain type added to the game
// but missing from `VILLAIN_ORDER` disappears from the guide silently — the
// only current signal is a console.warn at import time, which nothing reads.
// That is the game dealing an opponent it never explains.
import '@testing-library/jest-dom';
import { render, fireEvent, screen, within } from '@testing-library/react';
import VillainGuide from './VillainGuide';
import { SKILL_NAMES, PLAYER_SCHEMAS } from '../data/constants';
import { VILLAIN_LABELS } from '../data/scenarios';

const openTab = (name) => fireEvent.click(screen.getByRole('button', { name }));

// ── Dismissal ──────────────────────────────────────────────────────────────
describe('dismissal', () => {
  it('closes on Escape', () => {
    const onClose = jest.fn();
    render(<VillainGuide onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on other keys', () => {
    const onClose = jest.fn();
    render(<VillainGuide onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the backdrop is tapped', () => {
    const onClose = jest.fn();
    const { container } = render(<VillainGuide onClose={onClose} />);
    fireEvent.click(container.querySelector('.vg-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when the panel itself is tapped', () => {
    // Without stopPropagation the guide would shut every time a player tried
    // to scroll or select text inside it.
    const onClose = jest.fn();
    const { container } = render(<VillainGuide onClose={onClose} />);
    fireEvent.click(container.querySelector('.vg-panel'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ── Tabs ───────────────────────────────────────────────────────────────────
describe('tabs', () => {
  it('opens on Villains by default', () => {
    render(<VillainGuide onClose={jest.fn()} />);
    expect(screen.getByText(/The opponents you face/)).toBeInTheDocument();
  });

  it('honours initialTab — the dashboard schema card opens on Schemas', () => {
    render(<VillainGuide onClose={jest.fn()} initialTab="schemas" />);
    expect(screen.getByText(/How the trainer diagnoses you/)).toBeInTheDocument();
  });

  it('every tab renders its own content', () => {
    const { container } = render(<VillainGuide onClose={jest.fn()} />);

    openTab('Schemas');
    expect(screen.getByText(PLAYER_SCHEMAS[0].name)).toBeInTheDocument();

    openTab('Skills');
    expect(screen.getByText(/eight skills the trainer measures/)).toBeInTheDocument();

    openTab('Positions');
    expect(container.querySelector('.pos-diagram')).toBeInTheDocument();

    openTab('Glossary');
    expect(screen.getByText('Pot Odds')).toBeInTheDocument();
    // The glossary is the only tab with no intro paragraph.
    expect(screen.queryByText(/The opponents you face/)).not.toBeInTheDocument();
  });

  it('highlights the item the player tapped through to', () => {
    const label = PLAYER_SCHEMAS[0].name;
    const { container } = render(
      <VillainGuide onClose={jest.fn()} initialTab="schemas" focus={label} />);
    const focused = container.querySelector('.vg-item-focus');
    expect(focused).toBeInTheDocument();
    expect(within(focused).getByText(label)).toBeInTheDocument();
  });
});

// ── Skills tab ─────────────────────────────────────────────────────────────
// Before July 27 2026 this tab showed a rating legend with nothing rated
// beneath it — a key for a chart that wasn't there (founder report).
describe('skills tab', () => {
  it("shows the player's own rating on each skill", () => {
    const skills = Object.fromEntries(
      Object.keys(SKILL_NAMES).map((k, i) => [k, { rating: i === 0 ? 'green' : 'red' }]));
    const { container } = render(<VillainGuide onClose={jest.fn()} skills={skills} />);
    openTab('Skills');

    expect(container.querySelectorAll('.vg-item .vg-sym-green').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.vg-item .vg-sym-red').length).toBeGreaterThan(0);
    expect(container.querySelector('.vg-item-rating')).toHaveAttribute('title', 'Strong');
  });

  it('falls back to Unrated for a player with no history — never blank', () => {
    const { container } = render(<VillainGuide onClose={jest.fn()} />);
    openTab('Skills');

    const rated = container.querySelectorAll('.vg-item-rating');
    expect(rated.length).toBe(Object.keys(SKILL_NAMES).length);
    rated.forEach(el => expect(el).toHaveAttribute('title', 'Unrated'));
  });
});

// ── Content contracts ──────────────────────────────────────────────────────
describe('content contracts', () => {
  it('every villain the game can deal is explained in the guide', () => {
    render(<VillainGuide onClose={jest.fn()} />);
    // VILLAIN_LABELS is what the dealer stamps on a scenario. A type present
    // there but absent from VILLAIN_ORDER is filtered out of the guide with no
    // error — the player meets an opponent the reference never mentions.
    for (const label of Object.values(VILLAIN_LABELS)) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('…and each one carries a real description, not an empty card', () => {
    const { container } = render(<VillainGuide onClose={jest.fn()} />);
    const items = [...container.querySelectorAll('.vg-item')];
    expect(items.length).toBe(Object.keys(VILLAIN_LABELS).length);
    for (const item of items) {
      expect(item.querySelector('.vg-item-desc').textContent.trim().length)
        .toBeGreaterThan(20);
    }
  });

  it('every seat on the position diagram has a written entry, and vice versa', () => {
    const { container } = render(<VillainGuide onClose={jest.fn()} />);
    openTab('Positions');

    // Seat codes drawn on the SVG (the "6-MAX" felt label is not a seat).
    const drawn = [...container.querySelectorAll('.pos-diagram text')]
      .map(t => t.textContent.trim())
      .filter(t => t !== '6-MAX');
    // Written entries are labelled "BTN — The Button".
    const written = [...container.querySelectorAll('.vg-item-label')]
      .map(el => el.textContent.split('—')[0].trim());

    expect(drawn.length).toBeGreaterThan(0);
    expect(new Set(drawn)).toEqual(new Set(written));
  });
});
