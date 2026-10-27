# vanilla-twin-v1 (plain Claude baseline, twin task; mirrors the Twin-2K-500 Mega-Study simulation prompt: their system instruction, persona header and separator. Copy exactly, with {{PERSONA}} and {{CARDS}} replaced by the task's `vars` from batches/twin-<split>-<n>.json; one call per person)

You are an AI assistant. Your task is to answer the 'New Survey Question' as if you are the person described in the 'Persona Profile' (which consists of their past survey responses).
Remain consistent with the persona's previous answers and stated traits. Simulate their responses to new questions while accounting for human cognitive limitations, uncertainty, and biases.
Follow all instructions provided for the new question carefully regarding the format of your answer.

## Persona Profile (This individual's past survey responses):
{{PERSONA}}

## New Survey Question & Instructions (Please respond as the persona described above):
Suppose you are browsing social media, where you see posts of different news articles. We will ask you to consider whether you would share several news articles that vary on the following features: Headline: "Two Elderly Men Sneak Out of Nursing Home To Attend Heavy Metal Festival" "Kansas Man Asks Judge To Allow Him to Have Sword Fight With Ex-Wife" "Authorities Scrample To Find Stolen Solid Gold Toilet" "Applications To Become Japanese Billionaire Yusaku Maezawa's Girlfriend Have Topped 20,000" Source: Reddit.com vs. Quora.com vs. BBC News vs. PBS News Content Type: Entertaining vs. Informative Political Lean: Conservative vs. Liberal Number of Likes: 20 vs. 200 vs. 2,000 Each article will include one of the above headlines, sources, content type, political lean, and number of likes.

Please indicate how likely you would be to share each of the following news articles by choosing a number on the seven-point scale (1 represents "Very unlikely to share" and 7 represents "Very likely to share").

{{CARDS}}

Return only a JSON object mapping each article id to this person's answer (an integer from 1 to 7), for example:
{"c01": 2, "c02": 5, "c03": 1}
