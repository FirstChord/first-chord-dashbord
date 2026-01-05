# 🤖 Claude Context & Project Overview

**Last Updated**: September 29, 2025  
**Claude Version**: Sonnet 4 (claude-sonnet-4-20250514)  
**Project Status**: Production-ready with 177+ student portals  

## 🎯 Project Summary

This is the **Music School Dashboard** for FirstChord Music School - a Next.js application that provides:
1. **Tutor Dashboard** - Teachers can view all their students, notes, and manage data
2. **Individual Student Portals** - Students access their own notes, Soundslice courses, and Theta Music games via friendly URLs

**Live Site**: https://efficient-sparkle-production.up.railway.app  
**Deployment**: Railway auto-deploys from git pushes to main branch  

## 🏗️ Key Architecture Decisions

### **Student Portal System**
- **Friendly URLs**: `/craig` instead of `/student/sdt_L9nZJs`
- **Security Whitelist**: All student IDs must be in `VALID_STUDENT_IDS` array
- **Conflict Resolution**: Use `firstname-lastinitial` pattern (e.g., `olivia-w` vs `olivia`)
- **Complete Isolation**: Student portals don't affect tutor dashboard functionality

### **Configuration Strategy**
- **Modular Config Files**: Split by concern in `/lib/config/` directory
- **Hardcoded Mappings**: No database - all student data in JS files for performance
- **External Service Integration**: MyMusicStaff API, Soundslice, Theta Music

### **Deployment Philosophy**  
- **Git-based Deployment**: Railway auto-deploys on git push
- **Protocol-Driven Development**: All processes documented in markdown files
- **Manual Testing Required**: Always test locally before deploying

## 📁 Critical Files & Their Purposes

### **Student Portal Configuration**
```
lib/student-url-mappings.js     # Friendly URLs → MMS student IDs
lib/student-helpers.js          # Security whitelist + helper functions  
lib/soundslice-mappings.js      # Student ID → Soundslice course URLs
lib/config/theta-credentials.js # Student ID → Theta Music login credentials
```

### **Tutor & API Configuration**  
```
lib/mms-client.js              # MMS API client + teacher ID mappings
app/dashboard/page-client.js   # Tutor selection dropdown (15 tutors in 4x4 grid)
lib/config/services.js         # API authentication & external service configs
```

### **Protocol Documentation**
```
DEPLOYMENT_PROTOCOLS.md         # Complete deployment & maintenance guide
docs/ADDING_NEW_STUDENTS.md    # Step-by-step student portal setup
NOTES_EDGE_CASE_PROTOCOL.md    # Troubleshooting student notes issues
```

## 🔄 Recent Major Changes (Context)

### **Kenny Student Setup (Sept 29, 2025)**
- Added Kenny as 15th tutor to dashboard (now 4x4 grid layout)
- Set up 6 Kenny students with complete portal configuration
- Simplified URLs: `craig-m` → `craig`, `katie-b` → `katie`, etc.
- Kept `olivia-w` due to conflict with existing `olivia` (Olivia Mcintosh)
- **Teacher ID**: `tch_zsyfJr` (found via MMS payroll network console method)

### **Protocol Enhancement**
- Added quick troubleshooting sections to all protocol files
- Added cross-references between related protocols  
- Added version stamps and verification status
- Enhanced documentation for future Claude instances

## 🚨 Common Issues & Solutions

### **Student Portal Problems**
- **404 Error**: Check `student-url-mappings.js` and `VALID_STUDENT_IDS` whitelist
- **No Data Loading**: Verify MMS student ID format (`sdt_XXXXXX`) and existence
- **Missing Features**: Check respective mapping files for student entries

### **Deployment Issues**  
- **Build Fails**: Always run `npm run build` locally first
- **Railway Problems**: Railway auto-deploys from git push - no manual commands needed
- **Config Changes**: Restart dev server after modifying `/lib/config/` files

### **Development Workflow**
- **File Changes**: Use `git add .` (avoids macOS permission warnings)
- **Testing**: Always test manually before committing
- **Deployment**: `git push` triggers automatic Railway deployment

## 🎓 Student Portal Current Status

### **Implementation Scale**
- **177+ Students** across 15 tutors with individual portals
- **Friendly URLs** for all students with conflict resolution
- **Complete Integration** with Soundslice courses and Theta Music credentials

### **Tutor Coverage**
```
✅ Kenny (6 students) - Latest addition
✅ Finn (30+ students) - Largest implementation  
✅ Dean, Tom, Fennella, Patrick, Jungyoun, Eléna, David (all active)
🔄 Arion, Kim, Robbie, Stef (implemented, some with placeholder teacher IDs)
```

## 🛠️ Quick Context Recovery Commands

If context is lost, run these to understand current state:

```bash
# Project overview
git log --oneline -10
git status

# See protocol files  
ls *PROTOCOL*.md docs/

# Check student portal status
wc -l lib/student-url-mappings.js  # Count of students
grep -c "sdt_" lib/student-helpers.js  # Security whitelist count

# Test current functionality
npm run build  # Verify build works
curl -s -w "%{http_code}" https://efficient-sparkle-production.up.railway.app/craig  # Test live site
```

## 📋 Standard Operating Procedures

### **Adding New Students** 
1. Follow `docs/ADDING_NEW_STUDENTS.md` exactly
2. Update 4-5 files: url-mappings, student-helpers, soundslice-mappings, theta-credentials
3. Test locally, commit with descriptive message, push (auto-deploys)

### **Adding New Tutors**
1. Add to dashboard dropdown in `app/dashboard/page-client.js`  
2. Add teacher ID mapping in `lib/mms-client.js`
3. Set up their students using standard student process
4. Update grid layout if needed (currently 4x4 for 15 tutors)

### **Troubleshooting Workflow**
1. Check protocol files for quick fixes first
2. Test locally with `npm run dev`
3. Check git history for recent changes that might have caused issues
4. Verify Railway deployment logs if production issues

## 🔗 Important URLs & Resources

- **Live Dashboard**: https://efficient-sparkle-production.up.railway.app
- **Example Student Portal**: https://efficient-sparkle-production.up.railway.app/craig
- **GitHub Repo**: first-chord-dashbord (main branch)
- **Railway Project**: efficient-sparkle

## 💡 Development Philosophy

### **Key Principles**
- **Documentation-Driven**: Every process has a protocol file
- **Manual Testing**: Always verify functionality before deploying
- **Incremental Changes**: Small, well-tested commits over large changes
- **User Experience First**: Friendly URLs and intuitive interfaces prioritized

### **Code Patterns**
- **Hardcoded Mappings**: Performance over database complexity
- **Security Whitelist**: Explicit student ID validation for portal access
- **Modular Configuration**: Separate files for different concerns
- **Component Isolation**: Student portals don't interfere with tutor dashboard

---

## 📞 Context Handoff Instructions

**For Future Claude Instances:**

1. **Read this file first** to understand project scope and recent changes
2. **Check protocol files** in `*PROTOCOL*.md` and `docs/` for detailed procedures  
3. **Run context recovery commands** above to see current state
4. **Test understanding** by explaining the student portal system back to the user
5. **Follow established patterns** - don't reinvent working solutions

**Remember**: This is a production system serving real music students. Always test locally before deploying, and follow the documented protocols for consistency.