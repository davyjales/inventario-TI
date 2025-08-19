document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const equipmentId = urlParams.get('id');
    
    if (!equipmentId) {
        alert('ID do equipamento não fornecido');
        window.close();
        return;
    }

    loadEquipmentDetails(equipmentId);
});

async function loadEquipmentDetails(id) {
    try {
        // Fetch equipment details
        const response = await fetch(`/api/equipamentos/${id}`);
        if (!response.ok) throw new Error('Erro ao carregar equipamento');
        
        const equipment = await response.json();
        
        // Fetch category details if exists
        let additionalFields = [];
        if (equipment.categoria_id) {
            const catResponse = await fetch(`/api/categorias/${equipment.categoria_id}`);
            if (catResponse.ok) {
                const category = await catResponse.json();
                additionalFields = category.campos_adicionais || [];
            } else {
                console.warn('Categoria não encontrada ou erro ao buscar categoria');
            }
        }

        displayEquipmentDetails(equipment, additionalFields);
        generateQRCode(equipment);
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao carregar detalhes do equipamento');
    }
}

function displayEquipmentDetails(equipment, additionalFields) {
    console.log('equipment.additionalFields:', equipment.additionalFields);
    console.log('additionalFields:', additionalFields);

    const container = document.getElementById('equipment-details-container');
    
    let html = `
        <div class="detail-section">
            <h3>Informações Básicas</h3>
            <div class="field-group">
                <div class="field-item">
                    <div class="field-label">Service Tag:</div>
                    <div class="field-value">${equipment.nome || 'N/A'}</div>
                </div>
                <div class="field-item">
                    <div class="field-label">QR Code:</div>
                    <div class="field-value">${equipment.qrCode || 'N/A'}</div>
                </div>
                <div class="field-item">
                    <div class="field-label">Usuário:</div>
                    <div class="field-value">${equipment.dono || 'N/A'}</div>
                </div>
                <div class="field-item">
                    <div class="field-label">Setor:</div>
                    <div class="field-value">${equipment.setor || 'N/A'}</div>
                </div>
                <div class="field-item">
                    <div class="field-label">Cargo:</div>
                    <div class="field-value">${equipment.cargo || 'N/A'}</div>
                </div>
                <div class="field-item">
                    <div class="field-label">Categoria:</div>
                    <div class="field-value">${equipment.categoria || 'N/A'}</div>
                </div>
                <div class="field-item">
                    <div class="field-label">Status:</div>
                    <div class="field-value">${equipment.status || 'N/A'}</div>
                </div>
                <div class="field-item">
                    <div class="field-label">Descrição:</div>
                    <div class="field-value">${equipment.descricao || 'N/A'}</div>
                </div>
            </div>
        </div>
    `;

    // Add additional fields if they exist
    if (additionalFields && additionalFields.length > 0) {
        // Create a mapping from field id or nome_campo to display name
        const labelMap = {};
        additionalFields.forEach(field => {
            labelMap[field.id] = field.nome_exibicao || field.nome_campo;
        });

        const keys = Object.keys(equipment.additionalFields);
        html += '<div class="detail-section"><h3>Campos Adicionais</h3><div class="field-group">';
        keys.forEach(key => {
            const label = labelMap[key] || key;
            html += `
                <div class="field-item">
                    <div class="field-label">${label}:</div>
                    <div class="field-value">${equipment.additionalFields[key]}</div>
                </div>
            `;
        });
        html += '</div></div>';
    }

    container.innerHTML = html;
}

function generateQRCode(equipment) {
    const qrContainer = document.getElementById('qr-code-container');
    
    // Create QR code element
    const qrImg = document.createElement('img');
    qrImg.src = `/api/qrcode/${equipment.qrCode}`;
    qrImg.alt = `QR Code para ${equipment.nome}`;
    qrImg.className = 'qr-code';
    
    qrContainer.innerHTML = '';
    qrContainer.appendChild(qrImg);
}

function printQRCode() {
    window.print();
}

function printQRCodeForZebra() {
    const qrString = equipment.qrCode;
    const zebraString = `^XA^FO50,50^BQN,2,10^FDLA,${qrString}^FS^XZ`;
    
    // Copy to clipboard for Zebra printer
    navigator.clipboard.writeText(zebraString)
        .then(() => {
            alert('Código QR copiado para área de transferência no formato Zebra!');
        })
        .catch(err => {
            console.error('Erro ao copiar:', err);
            alert('Erro ao copiar código QR. Por favor, copie manualmente: ' + zebraString);
        });
}
