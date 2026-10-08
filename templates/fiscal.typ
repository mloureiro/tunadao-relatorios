#import "/templates/lib/page.typ": finish, lead, report, setup
#import "/templates/lib/sections.typ": render-sections

#show: setup

#lead()
#render-sections(report)
#finish()
