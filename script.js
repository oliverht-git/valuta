const form = document.querySelector('#change-form');
const result = document.querySelector('#result');
const currencySelect = document.querySelector('#currency-select');
const costInput = document.querySelector('#cost');
const paidInput = document.querySelector('#paid');

const currencies = {
    SEK: {
        locale: 'sv-SE',
        decimals: 0,
        denominations: [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1],
        noteMin: 20
    },
    EUR: {
        locale: 'de-DE',
        decimals: 2,
        denominations: [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1],
        noteMin: 500
    },
    GBP: {
        locale: 'en-GB',
        decimals: 2,
        denominations: [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1],
        noteMin: 500
    },
    USD: {
        locale: 'en-US',
        decimals: 2,
        denominations: [10000, 5000, 2000, 1000, 500, 200, 100, 25, 10, 5, 1],
        noteMin: 100
    }
};

function getCurrency() {
    return currencies[currencySelect.value];
}

function formatAmount(minorUnits) {
    const { locale, decimals } = getCurrency();
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencySelect.value,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(minorUnits / (10 ** decimals));
}

function updateCurrencyFields() {
    const { decimals } = getCurrency();
    const step = decimals === 0 ? '1' : '0.01';
    const example = decimals === 0 ? 'Skriv kostnad' : 'Skriv belopp';
    const currencyCode = currencySelect.value;

    for (const input of [costInput, paidInput]) {
        input.step = step;
        input.placeholder = example;
    }

    document.querySelectorAll('.currency').forEach((label) => {
        label.textContent = currencyCode;
    });
}

function toMinorUnits(input, decimals) {
    const value = Number(input.value);
    const multiplier = 10 ** decimals;

    if (input.value === '' || !Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * multiplier))) {
        return null;
    }

    const roundedValue = Math.round(value * multiplier);
    if (Math.abs(value * multiplier - roundedValue) > 0.000001) {
        return null;
    }

    return roundedValue;
}

currencySelect.addEventListener('change', updateCurrencyFields);
updateCurrencyFields();


form.addEventListener('submit', (event) => {
    event.preventDefault();

    const { decimals, denominations, noteMin } = getCurrency();
    const cost = toMinorUnits(costInput, decimals);
    const paid = toMinorUnits(paidInput, decimals);

    result.hidden = false;

    if (cost === null || paid === null) {
        const precisionMessage = decimals === 0 ? 'heltal' : 'belopp med högst två decimaler';
        result.innerHTML = `<p class="message error">Ange kostnad och betalning som ${precisionMessage} på 0 eller mer.</p>`;
        return;
    }

    if (paid < cost) {
        result.innerHTML = `<p class="message error">Betalningen räcker inte. Det saknas <strong>${formatAmount(cost - paid)}</strong>.</p>`;
        return;
    }

    let change = paid - cost;
    if (change === 0) {
        result.innerHTML = '<h2>Jämna pengar</h2><p class="message">Ingen växel ska lämnas tillbaka.</p>';
        return;
    }

    const total = change;
    const breakdown = denominations
        .map((value) => {
            const count = Math.floor(change / value);
            change %= value;
            return { value, count };
        })
        .filter(({ count }) => count > 0)
        .map(({ value, count }) => {
            const unit = value >= noteMin ? 'sedel' : 'mynt';
            const unitLabel = count === 1 ? unit : `${unit} (${unit === 'sedel' ? 'sedlar' : 'mynt'})`;
            return `<li><span>${formatAmount(value)} ${unitLabel}</span><strong>${count} st</strong></li>`;
        })
        .join('');

    result.innerHTML = `<h2>Växel att lämna tillbaka</h2><p class="result-total">${formatAmount(total)}</p><ul class="denominations">${breakdown}</ul>`;
});
