# IA — Análise de evidências

Aqui fica o modelo de IA que analisa as evidências das denúncias (RQ004).

## Como integrar a IA que já está pronta

1. Copie o código do protótipo para esta pasta.
2. Coloque os pesos do modelo em `ia/modelos/` (essa pasta está no `.gitignore` porque arquivos de modelo costumam passar do limite do GitHub; se forem pequenos, pode remover a linha).
3. Ajuste `analisador.py` para que a função `analisar(caminho_arquivo, tipo_mime)` chame o modelo e devolva:

```python
{"indicios": True, "confianca": 0.78, "rotulos": ["aproximação insistente"], "versao_modelo": "violet-ia-0.1"}
```

4. Liste as bibliotecas do modelo em `ia/requirements.txt`.

Pronto: o backend já chama essa função (em `backend/apps/ia/services.py`) para **toda** evidência anexada a uma denúncia e salva o resultado na tabela `denuncias_analiseia`. Se a IA falhar, a denúncia é registrada mesmo assim.

## Regra importante

O resultado é **apoio** à análise humana. Ele nunca deve ser mostrado como prova da ocorrência, e a usuária não vê a pontuação — só que a análise terminou.
