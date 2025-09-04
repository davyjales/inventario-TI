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

let globalEquipment = null;

async function loadEquipmentDetails(id) {
    try {
        // Fetch equipment details
        const response = await fetch(`/api/equipamentos/${id}`);
        if (!response.ok) throw new Error('Erro ao carregar equipamento');
        
        const equipment = await response.json();
        globalEquipment = equipment;
        
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
            const value = equipment.additionalFields[key];
            const label = labelMap[key] || key;

            // Check if the value is an array (list)
            if (Array.isArray(value)) {
                html += `<div class="field-item"><div class="field-label">${label}:</div><ul>`;
                value.forEach(item => {
                    html += `<li>${item}</li>`;
                });
                html += '</ul></div>';
            } else {
                html += `
                    <div class="field-item">
                        <div class="field-label">${label}:</div>
                        <div class="field-value">${value}</div>
                    </div>
                `;
            }
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
    if (!globalEquipment) {
        alert('Dados do equipamento não carregados. Por favor, aguarde o carregamento completo.');
        return;
    }
    const qrString = globalEquipment.qrCode.replace('.png', '');
    const zebraString = `^XA~TA000~JSN^LT0^MNW^MTT^PON^PMN^LH0,0^JMA^PR2,2~SD25^JUS^LRN^CI0^XZ
                            ^XA
                            ^MMT
                            ^PW900
                            ^LL0600
                            ^LS0
                            ^FT200,164^BQN,2,3
                            ^FDMA,${qrString}^FS
                            ^PQ1,0,1,Y^XZ`
                            ;
    
    // Copy to clipboard for Zebra printer
    						chamarImpressora(zebraString);

}
function chamarImpressora(array1) {
				if (typeof writeToSelectedPrinter === 'function') {
					writeToSelectedPrinter(array1);
				} else {
					console.error("Função writeToSelectedPrinter não está definida.");
				}
			}