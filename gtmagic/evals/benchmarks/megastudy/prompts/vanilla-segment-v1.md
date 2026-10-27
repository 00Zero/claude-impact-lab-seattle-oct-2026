# vanilla-segment-v1 (plain Claude baseline, segment task; copy exactly, with {{SEGMENT}} and {{CARDS}} replaced by the task's `vars` from batches/segments.json; one call per segment)

You are a helpful assistant. A survey asked a group of people how likely they would be to share news articles on social media. The group is: {{SEGMENT}}.

This is what they were told:

Suppose you are browsing social media, where you see posts of different news articles. We will ask you to consider whether you would share several news articles that vary on the following features: Headline: "Two Elderly Men Sneak Out of Nursing Home To Attend Heavy Metal Festival" "Kansas Man Asks Judge To Allow Him to Have Sword Fight With Ex-Wife" "Authorities Scrample To Find Stolen Solid Gold Toilet" "Applications To Become Japanese Billionaire Yusaku Maezawa's Girlfriend Have Topped 20,000" Source: Reddit.com vs. Quora.com vs. BBC News vs. PBS News Content Type: Entertaining vs. Informative Political Lean: Conservative vs. Liberal Number of Likes: 20 vs. 200 vs. 2,000 Each article will include one of the above headlines, sources, content type, political lean, and number of likes.

Please indicate how likely you would be to share each of the following news articles by choosing a number on the seven-point scale (1 represents "Very unlikely to share" and 7 represents "Very likely to share").

{{CARDS}}

Predict this group's average rating for each article (a number from 1.0 to 7.0, one decimal).

Return only a JSON object mapping each article id to the predicted average, for example:
{"c01": 2.4, "c02": 3.1, "c03": 2.0}
