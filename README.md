# Meu Financeiro V8.9.1 — Correção do Modo Paisagem

## Diagnóstico
O celular em modo paisagem reportou largura aproximada de 1157 px.
A V8.9.0 ativava o layout paisagem somente até 1100 px, portanto o aparelho ficava fora do breakpoint.

## Correção
- O modo paisagem mobile/tablet agora aceita até 1400 px quando o dispositivo reporta `hover:none`.
- Mantido fallback até 1100 px para navegadores móveis sem detecção consistente.
- Desktop comum permanece preservado.
- Nenhuma regra de orçamento foi alterada.
- Nenhuma regra financeira foi alterada.
- Nenhuma mudança no Supabase.

## Teste
1. Abrir criação/edição de orçamento no celular em retrato.
2. Digitar algum campo.
3. Girar o aparelho.
4. Conferir Itens comerciais em formato de linha semelhante ao desktop.
5. Voltar ao retrato e confirmar que os dados permanecem.
